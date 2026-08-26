import { Pinecone } from "@pinecone-database/pinecone";
import type { RecordMetadata } from "@pinecone-database/pinecone";
import { EMBEDDING_DIMENSION } from "./voyage";

export interface ChunkMetadata extends RecordMetadata {
  videoId: string;
  youtubeUrl: string;
  language: string;
  channel: string;
  videoTitle: string;
  text: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  ownerId: string;
  visibility: "base" | "private";
}

const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) throw new Error("PINECONE_API_KEY is not set");

const pinecone = new Pinecone({ apiKey });

const INDEX_NAME = process.env.PINECONE_INDEX ?? "language-clips";

export function getIndex() {
  return pinecone.index<ChunkMetadata>({ name: INDEX_NAME });
}

export { INDEX_NAME, EMBEDDING_DIMENSION };

export interface ChunkUpsertInput {
  vector: number[];
  metadata: ChunkMetadata;
}

export async function upsertChunks(chunks: ChunkUpsertInput[]) {
  if (chunks.length === 0) return;
  const index = getIndex();
  await index.upsert({
    records: chunks.map((chunk, i) => ({
      id: `${chunk.metadata.videoId}-${chunk.metadata.chunkIndex}-${i}`,
      values: chunk.vector,
      metadata: chunk.metadata,
    })),
  });
}

export interface RagMatch {
  text: string;
  videoTitle: string;
  channel: string;
  youtubeUrl: string;
  startTime: number;
  score: number;
}

export async function queryChunks(
  vector: number[],
  opts: { userId: string; topK?: number; language?: string },
): Promise<RagMatch[]> {
  const index = getIndex();

  // Pinecone ANDs sibling top-level filter keys implicitly, so `language` just sits
  // alongside `$or` rather than needing an explicit `$and`.
  const filter = {
    $or: [{ visibility: { $eq: "base" } }, { ownerId: { $eq: opts.userId } }],
    ...(opts.language && { language: { $eq: opts.language } }),
  };

  const result = await index.query({
    vector,
    topK: opts.topK ?? 5,
    includeMetadata: true,
    filter,
  });

  return result.matches
    .filter((match) => match.metadata)
    .map((match) => {
      const metadata = match.metadata as ChunkMetadata;
      return {
        text: metadata.text,
        videoTitle: metadata.videoTitle,
        channel: metadata.channel,
        youtubeUrl: metadata.youtubeUrl,
        startTime: metadata.startTime,
        score: match.score ?? 0,
      };
    });
}
