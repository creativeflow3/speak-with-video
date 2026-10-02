import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export const EMBEDDING_MODEL = "voyage-multilingual-2";
export const EMBEDDING_DIMENSION = 1024;
export const RERANK_MODEL = "rerank-3";

/** Per-call overrides for the client's defaults (60s timeout, with retries). */
export interface VoyageRequestOptions {
  timeoutInSeconds?: number;
  maxRetries?: number;
}

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

export interface RerankResult {
  /** Position of the document in the input list. */
  index: number;
  relevanceScore: number;
}

/** Score every document against the query with a cross-encoder; returns all of them, best first. */
export async function rerankDocuments(
  query: string,
  documents: string[],
  requestOptions?: VoyageRequestOptions,
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];
  const res = await voyage.rerank({ query, documents, model: RERANK_MODEL }, requestOptions);
  return (res.data ?? []).flatMap((item) =>
    item.index === undefined ? [] : [{ index: item.index, relevanceScore: item.relevanceScore ?? 0 }],
  );
}
