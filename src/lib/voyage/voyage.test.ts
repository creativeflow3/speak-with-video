import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  embedDocuments,
  embedQuery,
  rerankDocuments,
  EMBEDDING_MODEL,
  RERANK_MODEL,
} from "./voyage";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), rerank: vi.fn() }));

vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn().mockImplementation(() => ({ embed: mocks.embed, rerank: mocks.rerank })),
}));

describe("embedDocuments", () => {
  beforeEach(() => {
    mocks.embed.mockReset();
  });

  it("returns an empty array without calling the API for an empty input", async () => {
    const result = await embedDocuments([]);
    expect(result).toEqual([]);
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("embeds each text with inputType 'document' and extracts the embeddings", async () => {
    mocks.embed.mockResolvedValue({ data: [{ embedding: [1, 2] }, { embedding: [3, 4] }] });

    const result = await embedDocuments(["hola", "adiós"]);

    expect(mocks.embed).toHaveBeenCalledWith({
      input: ["hola", "adiós"],
      model: EMBEDDING_MODEL,
      inputType: "document",
    });
    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("defaults a missing embedding to an empty array", async () => {
    mocks.embed.mockResolvedValue({ data: [{}] });
    const result = await embedDocuments(["hola"]);
    expect(result).toEqual([[]]);
  });

  it("returns an empty array when the response has no data", async () => {
    mocks.embed.mockResolvedValue({ data: undefined });
    const result = await embedDocuments(["hola"]);
    expect(result).toEqual([]);
  });
});

describe("embedQuery", () => {
  beforeEach(() => {
    mocks.embed.mockReset();
  });

  it("embeds the text with inputType 'query' and returns the first embedding", async () => {
    mocks.embed.mockResolvedValue({ data: [{ embedding: [5, 6] }] });

    const result = await embedQuery("vale la pena");

    expect(mocks.embed).toHaveBeenCalledWith({
      input: "vale la pena",
      model: EMBEDDING_MODEL,
      inputType: "query",
    });
    expect(result).toEqual([5, 6]);
  });

  it("returns an empty array when there is no embedding", async () => {
    mocks.embed.mockResolvedValue({ data: [] });
    const result = await embedQuery("vale la pena");
    expect(result).toEqual([]);
  });
});

describe("rerankDocuments", () => {
  beforeEach(() => {
    mocks.rerank.mockReset();
  });

  it("returns an empty array without calling the API for no documents", async () => {
    const result = await rerankDocuments("vale la pena", []);
    expect(result).toEqual([]);
    expect(mocks.rerank).not.toHaveBeenCalled();
  });

  it("reranks every document (no topK) and maps the results in API order", async () => {
    mocks.rerank.mockResolvedValue({
      data: [
        { index: 1, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.2 },
      ],
    });

    const result = await rerankDocuments("vale la pena", ["hola", "vale la pena"], { timeoutInSeconds: 3 });

    expect(mocks.rerank).toHaveBeenCalledWith(
      { query: "vale la pena", documents: ["hola", "vale la pena"], model: RERANK_MODEL },
      { timeoutInSeconds: 3 },
    );
    expect(result).toEqual([
      { index: 1, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.2 },
    ]);
  });

  it("skips items without an index and defaults a missing score to 0", async () => {
    mocks.rerank.mockResolvedValue({ data: [{ relevanceScore: 0.5 }, { index: 0 }] });
    const result = await rerankDocuments("q", ["a"]);
    expect(result).toEqual([{ index: 0, relevanceScore: 0 }]);
  });

  it("returns an empty array when the response has no data", async () => {
    mocks.rerank.mockResolvedValue({ data: undefined });
    const result = await rerankDocuments("q", ["a"]);
    expect(result).toEqual([]);
  });
});
