import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RagMatch } from "@/lib/pinecone";
import { makeRagMatch } from "@/lib/pinecone/testUtils";
import { searchClips, CANDIDATE_K } from "./clipSearch";

const mocks = vi.hoisted(() => ({
  embedQuery: vi.fn(),
  rerankDocuments: vi.fn(),
  queryChunks: vi.fn(),
  log: vi.fn(),
}));

vi.mock("langsmith/traceable", () => ({ traceable: (fn: unknown) => fn }));
vi.mock("@/lib/voyage", () => ({ embedQuery: mocks.embedQuery, rerankDocuments: mocks.rerankDocuments }));
vi.mock("@/lib/pinecone", () => ({ queryChunks: mocks.queryChunks }));
vi.mock("@/lib/logger", () => ({ log: mocks.log }));

function match(videoId: string, text: string): RagMatch {
  return makeRagMatch({ videoId, text });
}

const opts = { userId: "user-1" };

describe("searchClips", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.embedQuery.mockResolvedValue([0.1, 0.2]);
  });

  it("fetches a wide candidate pool with the user's filters", async () => {
    mocks.queryChunks.mockResolvedValue([]);

    await searchClips("vale la pena", { userId: "user-1", language: "es" });

    expect(mocks.embedQuery).toHaveBeenCalledWith("vale la pena");
    expect(mocks.queryChunks).toHaveBeenCalledWith([0.1, 0.2], {
      userId: "user-1",
      language: "es",
      topK: CANDIDATE_K,
    });
  });

  it("never fetches fewer candidates than topK", async () => {
    mocks.queryChunks.mockResolvedValue([]);
    await searchClips("q", { ...opts, topK: 10, candidateK: 3 });
    expect(mocks.queryChunks).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ topK: 10 }));
  });

  it("returns candidates in rerank order with rerank scores", async () => {
    mocks.queryChunks.mockResolvedValue([match("a", "first"), match("b", "second")]);
    mocks.rerankDocuments.mockResolvedValue([
      { index: 1, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.1 },
    ]);

    const result = await searchClips("q", opts);

    expect(mocks.rerankDocuments).toHaveBeenCalledWith("q", ["first", "second"], {
      timeoutInSeconds: 3,
      maxRetries: 0,
    });
    expect(result.matches.map((m) => [m.text, m.score])).toEqual([
      ["second", 0.9],
      ["first", 0.1],
    ]);
    expect(result.reranked).toBe(true);
    expect(result.candidateCount).toBe(2);
  });

  it("caps clips per video after reranking", async () => {
    mocks.queryChunks.mockResolvedValue([match("a", "a1"), match("a", "a2"), match("a", "a3"), match("b", "b1")]);
    mocks.rerankDocuments.mockResolvedValue([0, 1, 2, 3].map((index) => ({ index, relevanceScore: 1 - index / 10 })));

    const result = await searchClips("q", { ...opts, topK: 3 });

    expect(result.matches.map((m) => m.text)).toEqual(["a1", "a2", "b1"]);
  });

  it("falls back to dense order (still capped) when reranking fails", async () => {
    mocks.queryChunks.mockResolvedValue([match("a", "a1"), match("a", "a2"), match("a", "a3"), match("b", "b1")]);
    mocks.rerankDocuments.mockRejectedValue(new Error("voyage down"));

    const result = await searchClips("q", { ...opts, topK: 3 });

    expect(result.matches.map((m) => m.text)).toEqual(["a1", "a2", "b1"]);
    expect(result.reranked).toBe(false);
    expect(mocks.log).toHaveBeenCalledWith("rerank_failed", { error: "voyage down" });
  });

  it("skips the reranker when there are no candidates", async () => {
    mocks.queryChunks.mockResolvedValue([]);
    const result = await searchClips("q", opts);
    expect(result.matches).toEqual([]);
    expect(mocks.rerankDocuments).not.toHaveBeenCalled();
  });
});
