import { describe, it, expect, vi, beforeEach } from "vitest";
import { embedQuery } from "@/lib/voyage";
import { queryChunks } from "@/lib/pinecone";
import { searchRag } from "./searchRag";
import { makeToolContext } from "./testUtils";

vi.mock("@/lib/voyage", () => ({ embedQuery: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ queryChunks: vi.fn() }));

const context = makeToolContext();

describe("searchRag", () => {
  beforeEach(() => {
    vi.mocked(embedQuery).mockReset();
    vi.mocked(queryChunks).mockReset();
  });

  it("embeds the query and passes userId/language/topK through to queryChunks", async () => {
    vi.mocked(embedQuery).mockResolvedValue([0.1, 0.2]);
    vi.mocked(queryChunks).mockResolvedValue([]);

    const tool = searchRag(context);
    await tool.run({ query: "vale la pena", language: "es", topK: 3 });

    expect(embedQuery).toHaveBeenCalledWith("vale la pena");
    expect(queryChunks).toHaveBeenCalledWith([0.1, 0.2], { userId: "user-1", topK: 3, language: "es" });
  });

  it("returns a plain message when there are no matches", async () => {
    vi.mocked(embedQuery).mockResolvedValue([]);
    vi.mocked(queryChunks).mockResolvedValue([]);

    const tool = searchRag(context);
    const result = await tool.run({ query: "anything" });

    expect(result).toBe("No matching examples were found in the ingested videos.");
  });

  it("formats matches with a deep link for a real YouTube URL", async () => {
    vi.mocked(embedQuery).mockResolvedValue([]);
    vi.mocked(queryChunks).mockResolvedValue([
      {
        text: "vale la pena",
        videoTitle: "Title",
        channel: "Channel",
        youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        startTime: 12.7,
        score: 0.9,
      },
    ]);

    const tool = searchRag(context);
    const result = (await tool.run({ query: "vale la pena" })) as string;

    expect(result).toContain('1. "vale la pena"');
    expect(result).toContain("Video: Title (Channel)");
    expect(result).toContain("Link: https://youtu.be/abcdefghijk?t=12");
  });

  it("falls back to the raw URL when it can't be parsed as a YouTube video ID", async () => {
    vi.mocked(embedQuery).mockResolvedValue([]);
    vi.mocked(queryChunks).mockResolvedValue([
      {
        text: "hola",
        videoTitle: "Title",
        channel: "Channel",
        youtubeUrl: "https://example.com/not-youtube",
        startTime: 0,
        score: 0.5,
      },
    ]);

    const tool = searchRag(context);
    const result = (await tool.run({ query: "hola" })) as string;

    expect(result).toContain("Link: https://example.com/not-youtube");
  });
});
