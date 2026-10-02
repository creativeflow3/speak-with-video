import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchClips, type SearchClipsResult } from "@/lib/clip-search";
import type { RagMatch } from "@/lib/pinecone";
import { makeRagMatch as match } from "@/lib/pinecone/testUtils";
import { searchRag } from "./searchRag";
import { makeToolContext } from "./testUtils";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/languages";

vi.mock("@/lib/clip-search", () => ({ searchClips: vi.fn() }));

const context = makeToolContext();

function result(matches: RagMatch[]): SearchClipsResult {
  return { matches, candidateCount: matches.length, reranked: true, rerankMs: 0 };
}

describe("searchRag", () => {
  beforeEach(() => {
    vi.mocked(searchClips).mockReset();
  });

  it("passes the query, userId, language, and topK through to searchClips", async () => {
    vi.mocked(searchClips).mockResolvedValue(result([]));

    const tool = searchRag(context);
    await tool.run({ query: "vale la pena", language: "es", topK: 3 });

    expect(searchClips).toHaveBeenCalledWith("vale la pena", { userId: "user-1", language: "es", topK: 3 });
  });

  it("only accepts the base language codes chunks are stored under", () => {
    const tool = searchRag(context);

    // The JSON schema Claude sees lists the allowed codes (zod emits the enum under $defs).
    expect(JSON.stringify(tool)).toContain(`"enum":${JSON.stringify(SUPPORTED_LANGUAGE_CODES)}`);
    expect(tool.parse({ query: "ou seja", language: "pt" })).toMatchObject({ language: "pt" });
    for (const invalid of ["pt-BR", "es-MX", "spanish"]) {
      expect(() => tool.parse({ query: "ou seja", language: invalid })).toThrow();
    }
  });

  it("returns a plain message when there are no matches", async () => {
    vi.mocked(searchClips).mockResolvedValue(result([]));

    const tool = searchRag(context);
    const output = await tool.run({ query: "anything" });

    expect(output).toBe("No matching examples were found in the ingested videos.");
  });

  it("formats matches in the order searchClips returns them", async () => {
    vi.mocked(searchClips).mockResolvedValue(result([match({ text: "first" }), match({ text: "second" })]));

    const tool = searchRag(context);
    const output = (await tool.run({ query: "q" })) as string;

    expect(output.indexOf('1. "first"')).toBeLessThan(output.indexOf('2. "second"'));
  });

  it("formats matches with a deep link for a real YouTube URL", async () => {
    vi.mocked(searchClips).mockResolvedValue(result([match({ startTime: 12.7 })]));

    const tool = searchRag(context);
    const output = (await tool.run({ query: "vale la pena" })) as string;

    expect(output).toContain('1. "vale la pena"');
    expect(output).toContain("Video: Title (Channel)");
    expect(output).toContain("Link: https://youtu.be/abcdefghijk?t=12");
  });
});
