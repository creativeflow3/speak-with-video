/**
 * Retrieval eval — runs every graded case in retrievalCases.ts against the real
 * Voyage + Pinecone search stages (no dev server needed) under several
 * configurations, and prints nDCG@5 / hit@5 / MRR@5 / distinct videos side by
 * side so reranking and the per-video cap can be compared against plain dense
 * search (the baseline).
 *
 *   npm run test:evals:retrieval
 *
 * Searches run as EVAL_USER_ID (default: a user with no private videos, so only
 * base videos are visible). Set it to the owner's id to include private videos.
 */
import { describe, it } from "vitest";
import { capPerVideo, rerankMatches, CANDIDATE_K, MAX_PER_VIDEO } from "@/lib/clip-search";
import { embedQuery } from "@/lib/voyage";
import { queryChunks, type RagMatch } from "@/lib/pinecone";
import {
  gradeClips,
  ndcgAtK,
  hitAtK,
  reciprocalRankAtK,
  distinctVideos,
  mean,
} from "@/lib/retrieval-metrics";
import { RETRIEVAL_CASES, type RetrievalCase } from "./retrievalCases";

const K = 5;
const USER_ID = process.env.EVAL_USER_ID ?? "retrieval-eval";

/** One dense search and one rerank per case — every config reads from these. */
interface CasePools {
  dense: RagMatch[];
  reranked: RagMatch[];
}

const CONFIGS: Record<string, (p: CasePools) => RagMatch[]> = {
  "dense (baseline)": (p) => p.dense.slice(0, K),
  "rerank, no cap": (p) => p.reranked.slice(0, K),
  "rerank + cap 1": (p) => capPerVideo(p.reranked, 1, K),
  [`rerank + cap ${MAX_PER_VIDEO} (shipped)`]: (p) => capPerVideo(p.reranked, MAX_PER_VIDEO, K),
};

interface CaseScore {
  ndcg: number;
  hit: number;
  rr: number;
  videos: number;
  multiVideo: boolean;
}

async function buildPools(c: RetrievalCase): Promise<CasePools> {
  const vector = await embedQuery(c.query);
  const dense = await queryChunks(vector, { userId: USER_ID, language: c.language, topK: CANDIDATE_K });
  // Client-default timeout and retries: unlike chat search, the eval can afford to wait.
  const ranked = await rerankMatches(c.query, dense, { maxRetries: 2 });
  // rerankMatches falls back to dense order on failure — that would silently score dense as "rerank".
  if (!ranked.reranked) throw new Error(`Rerank failed for "${c.query}" — see rerank_failed log`);
  return { dense, reranked: ranked.matches };
}

function scoreCase(c: RetrievalCase, matches: RagMatch[]): CaseScore {
  const grades = gradeClips(matches, c.relevant);
  return {
    ndcg: ndcgAtK(grades, c.relevant, K),
    hit: hitAtK(grades, K),
    rr: reciprocalRankAtK(grades, K),
    videos: distinctVideos(matches),
    multiVideo: distinctVideos(c.relevant.filter((l) => l.grade >= 1)) >= 2,
  };
}

function summarize(scores: CaseScore[]) {
  const multi = scores.filter((s) => s.multiVideo);
  const fmt = (n: number) => n.toFixed(3);
  return {
    "nDCG@5": fmt(mean(scores.map((s) => s.ndcg))),
    "hit@5": fmt(mean(scores.map((s) => s.hit))),
    "MRR@5": fmt(mean(scores.map((s) => s.rr))),
    "multi-video nDCG@5": fmt(mean(multi.map((s) => s.ndcg))),
    "multi-video avg videos": fmt(mean(multi.map((s) => s.videos))),
  };
}

describe("retrieval eval", () => {
  it(
    "compares search configurations on the graded cases",
    async () => {
      if (RETRIEVAL_CASES.length === 0) {
        throw new Error(
          'No graded cases yet. Run `npm run eval:label -- "phrase"`, paste the output into ' +
            "src/lib/evals/retrievalCases.ts, and set each grade (2 great / 1 weak / 0 false hit).",
        );
      }

      // Sequential on purpose — stays well under Voyage/Pinecone rate limits.
      const pools: CasePools[] = [];
      for (const c of RETRIEVAL_CASES) pools.push(await buildPools(c));

      const table = Object.fromEntries(
        Object.entries(CONFIGS).map(([name, select]) => [
          name,
          summarize(RETRIEVAL_CASES.map((c, i) => scoreCase(c, select(pools[i])))),
        ]),
      );

      console.log(`\nRetrieval eval — ${RETRIEVAL_CASES.length} cases, k=${K}`);
      console.table(table);
    },
    300_000,
  );
});
