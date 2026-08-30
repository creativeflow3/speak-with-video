import { describe, it, expect, vi, beforeEach } from "vitest";
import { embedDocuments, embedQuery, EMBEDDING_MODEL } from "./voyage";

const mocks = vi.hoisted(() => ({ embed: vi.fn() }));

vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn().mockImplementation(() => ({ embed: mocks.embed })),
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
