/**
 * Labeling helper for the retrieval eval. Scans every chunk stored in Pinecone
 * for the given phrases (case- and accent-insensitive) and prints each hit as a
 * RetrievalCase entry ready to paste into src/lib/evals/retrievalCases.ts.
 * Like the eval, it only sees base videos plus EVAL_USER_ID's private ones.
 * Every hit starts at grade 1 — read the text and change it to 2 or 0.
 *
 *   npm run eval:label -- "vale la pena" "valió la pena"
 *
 * The first phrase becomes the case's query; the rest are variants that also
 * count as occurrences (conjugations, alternate spellings).
 */
import "dotenv/config";
import { getIndex, type ChunkMetadata } from "@/lib/pinecone";

const FETCH_BATCH = 100;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// Chunks overlap by one segment, so a chunk's own midpoint is the one moment no
// neighboring chunk also covers — only retrieving this exact chunk earns credit.
function midpoint(c: ChunkMetadata): number {
  return Math.round(((c.startTime + c.endTime) / 2) * 10) / 10;
}

async function listAllIds(): Promise<string[]> {
  const index = getIndex();
  const ids: string[] = [];
  let paginationToken: string | undefined;
  do {
    const page = await index.listPaginated({ paginationToken });
    ids.push(...(page.vectors ?? []).flatMap((v) => (v.id ? [v.id] : [])));
    paginationToken = page.pagination?.next;
  } while (paginationToken);
  return ids;
}

async function fetchAllChunks(): Promise<ChunkMetadata[]> {
  const index = getIndex();
  const ids = await listAllIds();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += FETCH_BATCH) batches.push(ids.slice(i, i + FETCH_BATCH));
  const responses = await Promise.all(batches.map((batch) => index.fetch({ ids: batch })));
  return responses.flatMap(({ records }) => Object.values(records).flatMap((r) => (r.metadata ? [r.metadata] : [])));
}

async function main() {
  const phrases = process.argv.slice(2);
  if (phrases.length === 0) throw new Error('Usage: npm run eval:label -- "phrase" ["variant" ...]');

  const needles = phrases.map(normalize);
  const chunks = await fetchAllChunks();
  // Only chunks the eval can retrieve: base videos, plus EVAL_USER_ID's own private ones.
  const visible = chunks.filter((c) => c.visibility === "base" || c.ownerId === process.env.EVAL_USER_ID);
  const hits = visible
    .filter((c) => needles.some((n) => normalize(c.text).includes(n)))
    .sort((a, b) => a.videoId.localeCompare(b.videoId) || a.startTime - b.startTime);

  console.error(`Scanned ${visible.length} visible chunks; ${hits.length} contain ${phrases.map((p) => `"${p}"`).join(" / ")}.`);
  console.error("Overlapping chunks can repeat one occurrence — keep one entry per real occurrence.\n");

  const entries = hits.map(
    (c) =>
      `      // ${c.videoTitle} @ ${Math.floor(c.startTime)}s: "${c.text.replace(/\s+/g, " ")}"\n` +
      `      { videoId: "${c.videoId}", time: ${midpoint(c)}, grade: 1 },`,
  );
  const language = hits[0]?.language;
  console.log(
    `  {\n    query: ${JSON.stringify(phrases[0])},\n` +
      (language ? `    language: "${language}",\n` : "") +
      `    relevant: [\n${entries.join("\n")}\n    ],\n  },`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
