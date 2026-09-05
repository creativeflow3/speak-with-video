import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryChunks, upsertChunks, getIndex, type ChunkMetadata } from "./pinecone";

const mocks = vi.hoisted(() => ({ query: vi.fn(), upsert: vi.fn(), index: vi.fn() }));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: vi.fn().mockImplementation(() => ({
    index: mocks.index.mockReturnValue({ query: mocks.query, upsert: mocks.upsert }),
  })),
}));

function chunkMetadata(overrides: Partial<ChunkMetadata> = {}): ChunkMetadata {
  return {
    videoId: "vid1",
    youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    language: "es",
    channel: "Channel",
    videoTitle: "Title",
    text: "vale la pena",
    chunkIndex: 0,
    startTime: 0,
    endTime: 5,
    ownerId: "user-1",
    visibility: "base",
    ...overrides,
  };
}

describe("getIndex", () => {
  it("opens the configured Pinecone index", () => {
    getIndex();
    expect(mocks.index).toHaveBeenCalled();
  });
});

describe("upsertChunks", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
  });

  it("does nothing for an empty list", async () => {
    await upsertChunks([]);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts one record per chunk with a derived id", async () => {
    const meta1 = chunkMetadata({ videoId: "vid1", chunkIndex: 2 });
    const meta2 = chunkMetadata({ videoId: "vid2", chunkIndex: 0 });

    await upsertChunks([
      { vector: [0.1], metadata: meta1 },
      { vector: [0.2], metadata: meta2 },
    ]);

    expect(mocks.upsert).toHaveBeenCalledWith({
      records: [
        { id: "vid1-2-0", values: [0.1], metadata: meta1 },
        { id: "vid2-0-1", values: [0.2], metadata: meta2 },
      ],
    });
  });
});

describe("queryChunks", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("filters to base videos or the user's own, with a default topK of 5", async () => {
    mocks.query.mockResolvedValue({ matches: [] });

    await queryChunks([0.1, 0.2], { userId: "user-1" });

    expect(mocks.query).toHaveBeenCalledWith({
      vector: [0.1, 0.2],
      topK: 5,
      includeMetadata: true,
      filter: { $or: [{ visibility: { $eq: "base" } }, { ownerId: { $eq: "user-1" } }] },
    });
  });

  it("adds a language filter and honors a custom topK when provided", async () => {
    mocks.query.mockResolvedValue({ matches: [] });

    await queryChunks([0.1], { userId: "user-1", topK: 3, language: "es" });

    expect(mocks.query).toHaveBeenCalledWith({
      vector: [0.1],
      topK: 3,
      includeMetadata: true,
      filter: {
        $or: [{ visibility: { $eq: "base" } }, { ownerId: { $eq: "user-1" } }],
        language: { $eq: "es" },
      },
    });
  });

  it("maps matches to RagMatch, skipping ones without metadata", async () => {
    mocks.query.mockResolvedValue({
      matches: [
        { score: 0.9, metadata: chunkMetadata({ text: "vale la pena" }) },
        { score: 0.5, metadata: undefined },
      ],
    });

    const result = await queryChunks([0.1], { userId: "user-1" });

    expect(result).toEqual([
      {
        text: "vale la pena",
        videoTitle: "Title",
        channel: "Channel",
        youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        startTime: 0,
        score: 0.9,
      },
    ]);
  });

  it("defaults score to 0 when a match has no score", async () => {
    mocks.query.mockResolvedValue({
      matches: [{ score: undefined, metadata: chunkMetadata() }],
    });

    const result = await queryChunks([0.1], { userId: "user-1" });

    expect(result[0].score).toBe(0);
  });
});
