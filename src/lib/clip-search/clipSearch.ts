import { traceable } from "langsmith/traceable";
import { embedQuery, rerankDocuments, type VoyageRequestOptions } from "@/lib/voyage";
import { queryChunks, type RagMatch } from "@/lib/pinecone";
import { log } from "@/lib/logger";
import type { SupportedLanguageCode } from "@/lib/languages";
import { capPerVideo } from "./capPerVideo";

/** How many dense-search candidates the reranker gets to choose from. */
export const CANDIDATE_K = 50;
/** Most clips returned from any one video, so one video can't fill every slot. */
export const MAX_PER_VIDEO = 2;
/**
 * Reranking is optional — on failure we fall back to dense order — so fail fast
 * rather than let the client's default 60s timeout + retries stall a chat search.
 */
const FAIL_FAST_RERANK: VoyageRequestOptions = { timeoutInSeconds: 3, maxRetries: 0 };
const DEFAULT_TOP_K = 5;

export interface SearchClipsOptions {
  userId: string;
  language?: SupportedLanguageCode;
  topK?: number;
  candidateK?: number;
  maxPerVideo?: number;
}

export interface SearchClipsResult {
  matches: RagMatch[];
  candidateCount: number;
  reranked: boolean;
  rerankMs: number;
}

type RankedMatches = Omit<SearchClipsResult, "candidateCount">;

// Own LangSmith "tool" span, so rerank latency and failures show up separately in traces.
const tracedRerank = traceable(rerankDocuments, { name: "rerank", run_type: "tool" });

/** Reorder candidates by cross-encoder score; on failure, keep dense order so search still works. */
export async function rerankMatches(
  query: string,
  candidates: RagMatch[],
  requestOptions: VoyageRequestOptions = FAIL_FAST_RERANK,
): Promise<RankedMatches> {
  const start = Date.now();
  try {
    const results = await tracedRerank(query, candidates.map((c) => c.text), requestOptions);
    const matches = results.map(({ index, relevanceScore }) => ({ ...candidates[index], score: relevanceScore }));
    return { matches, reranked: true, rerankMs: Date.now() - start };
  } catch (err) {
    log("rerank_failed", { error: err instanceof Error ? err.message : String(err) });
    return { matches: candidates, reranked: false, rerankMs: Date.now() - start };
  }
}

/**
 * Two-stage clip retrieval: dense search for a wide candidate pool, cross-encoder
 * rerank, then a per-video cap down to `topK`.
 */
export const searchClips = traceable(
  async (query: string, opts: SearchClipsOptions): Promise<SearchClipsResult> => {
    const topK = opts.topK ?? DEFAULT_TOP_K;
    const vector = await embedQuery(query);
    const candidates = await queryChunks(vector, {
      userId: opts.userId,
      language: opts.language,
      topK: Math.max(opts.candidateK ?? CANDIDATE_K, topK),
    });

    const ranked =
      candidates.length === 0
        ? { matches: candidates, reranked: false, rerankMs: 0 }
        : await rerankMatches(query, candidates);

    return {
      ...ranked,
      matches: capPerVideo(ranked.matches, opts.maxPerVideo ?? MAX_PER_VIDEO, topK),
      candidateCount: candidates.length,
    };
  },
  { name: "search_clips", run_type: "retriever" },
);
