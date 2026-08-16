import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export const EMBEDDING_MODEL = "voyage-multilingual-2";
export const EMBEDDING_DIMENSION = 1024;

function extractEmbeddings(data: Array<{ embedding?: number[] }> | undefined): number[][] {
  if (!data) return [];
  return data.map((item) => item.embedding ?? []);
}

/** Embed transcript chunks for storage — use inputType "document" for ingest-time embeddings. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await voyage.embed({
    input: texts,
    model: EMBEDDING_MODEL,
    inputType: "document",
  });
  return extractEmbeddings(res.data);
}

/** Embed a single search query — use inputType "query" for retrieval-time embeddings. */
export async function embedQuery(text: string): Promise<number[]> {
  const res = await voyage.embed({
    input: text,
    model: EMBEDDING_MODEL,
    inputType: "query",
  });
  return extractEmbeddings(res.data)[0] ?? [];
}
