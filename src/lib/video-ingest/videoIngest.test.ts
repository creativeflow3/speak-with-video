import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  videoIngest,
  IngestValidationError,
  type VideoIngestInput,
} from "./videoIngest";

const mocks = vi.hoisted(() => {
  class FakeTranscriptApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TranscriptApiError";
    }
  }
  return {
    fetchTranscript: vi.fn(),
    fetchOEmbed: vi.fn(),
    chunkTranscript: vi.fn(),
    checkTranscriptLanguage: vi.fn(),
    embedDocuments: vi.fn(),
    upsertChunks: vi.fn(),
    markVideoSucceeded: vi.fn(),
    recordTranscriptApiUsage: vi.fn(),
    log: vi.fn(),
    FakeTranscriptApiError,
  };
});

vi.mock("langsmith/traceable", () => ({ traceable: (fn: unknown) => fn }));

const FakeTranscriptApiError = mocks.FakeTranscriptApiError;

vi.mock("@/lib/transcript/transcriptapi", () => ({
  fetchTranscript: mocks.fetchTranscript,
  TranscriptApiError: mocks.FakeTranscriptApiError,
}));
vi.mock("@/lib/youtube", () => ({ fetchOEmbed: mocks.fetchOEmbed }));
vi.mock("@/lib/transcript/chunk", () => ({ chunkTranscript: mocks.chunkTranscript }));
vi.mock("@/lib/transcript/language", () => ({
  checkTranscriptLanguage: mocks.checkTranscriptLanguage,
  sampleForLanguageCheck: (segments: unknown) => segments,
}));
vi.mock("@/lib/voyage", () => ({ embedDocuments: mocks.embedDocuments }));
vi.mock("@/lib/pinecone", () => ({ upsertChunks: mocks.upsertChunks }));
vi.mock("@/lib/logger", () => ({ log: mocks.log }));
vi.mock("@/services/ingest.service", () => ({
  markVideoSucceeded: mocks.markVideoSucceeded,
  recordTranscriptApiUsage: mocks.recordTranscriptApiUsage,
}));

function baseInput(overrides: Partial<VideoIngestInput> = {}): VideoIngestInput {
  return {
    videoId: "abc123",
    youtubeUrl: "https://www.youtube.com/watch?v=abc123",
    language: "es",
    ownerId: "user-1",
    visibility: "private",
    ...overrides,
  };
}

const transcript = {
  segments: [{ text: "hola mundo", start: 0, duration: 2 }],
  title: "A video",
  channel: "A channel",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchTranscript.mockResolvedValue(transcript);
  mocks.checkTranscriptLanguage.mockReturnValue({ matches: true, detected: "spa" });
  mocks.chunkTranscript.mockReturnValue([
    { text: "hola mundo", startTime: 0, endTime: 2, chunkIndex: 0 },
  ]);
  mocks.embedDocuments.mockResolvedValue([[0.1, 0.2]]);
  mocks.upsertChunks.mockResolvedValue(undefined);
  mocks.markVideoSucceeded.mockResolvedValue(undefined);
  mocks.recordTranscriptApiUsage.mockResolvedValue(undefined);
});

describe("videoIngest", () => {
  it("returns a summary and marks the video succeeded on the happy path", async () => {
    const result = await videoIngest(baseInput());

    expect(result).toEqual({
      videoId: "abc123",
      chunkCount: 1,
      title: "A video",
      channel: "A channel",
    });
    expect(mocks.markVideoSucceeded).toHaveBeenCalledWith("abc123", {
      title: "A video",
      channel: "A channel",
      chunkCount: 1,
    });
    expect(mocks.log).toHaveBeenCalledWith("ingest_succeeded", {
      videoId: "abc123",
      chunkCount: 1,
    });
  });

  it("passes ownerId and visibility through into each chunk's metadata", async () => {
    await videoIngest(baseInput({ ownerId: "owner-9", visibility: "base" }));

    expect(mocks.upsertChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        vector: [0.1, 0.2],
        metadata: expect.objectContaining({ ownerId: "owner-9", visibility: "base" }),
      }),
    ]);
  });

  it("records failed usage and throws a 422 IngestValidationError when the transcript API errors", async () => {
    mocks.fetchTranscript.mockRejectedValue(new FakeTranscriptApiError("captions unavailable"));

    await expect(videoIngest(baseInput())).rejects.toMatchObject({
      message: "captions unavailable",
      status: 422,
    });
    expect(mocks.recordTranscriptApiUsage).toHaveBeenCalledWith("abc123", false);
    expect(mocks.markVideoSucceeded).not.toHaveBeenCalled();
  });

  it("throws a generic 422 when the transcript fetch fails with a non-API error", async () => {
    mocks.fetchTranscript.mockRejectedValue(new Error("boom"));

    await expect(videoIngest(baseInput())).rejects.toMatchObject({
      message: "Unknown transcript fetch error",
      status: 422,
    });
  });

  it("throws IngestValidationError when the detected language doesn't match", async () => {
    mocks.checkTranscriptLanguage.mockReturnValue({ matches: false, detected: "eng" });

    await expect(videoIngest(baseInput())).rejects.toBeInstanceOf(IngestValidationError);
    await expect(videoIngest(baseInput())).rejects.toMatchObject({
      message: 'Transcript appears to be in "eng", not the requested "es"',
      status: 422,
    });
  });

  it("throws IngestValidationError when chunking produces no chunks", async () => {
    mocks.chunkTranscript.mockReturnValue([]);

    await expect(videoIngest(baseInput())).rejects.toMatchObject({
      message: "Transcript was empty after chunking",
      status: 422,
    });
    expect(mocks.embedDocuments).not.toHaveBeenCalled();
  });

  it("falls back to oembed when the transcript has no title/channel and no overrides were given", async () => {
    mocks.fetchTranscript.mockResolvedValue({ ...transcript, title: null, channel: null });
    mocks.fetchOEmbed.mockResolvedValue({ title: "Oembed title", channel: "Oembed channel" });

    const result = await videoIngest(baseInput());

    expect(mocks.fetchOEmbed).toHaveBeenCalledWith(baseInput().youtubeUrl);
    expect(result.title).toBe("Oembed title");
    expect(result.channel).toBe("Oembed channel");
  });

  it("prefers an explicit override over the transcript's own title/channel", async () => {
    mocks.fetchTranscript.mockResolvedValue({ ...transcript, title: null, channel: null });

    const result = await videoIngest(
      baseInput({ titleOverride: "Override title", channelOverride: "Override channel" }),
    );

    expect(mocks.fetchOEmbed).not.toHaveBeenCalled();
    expect(result.title).toBe("Override title");
    expect(result.channel).toBe("Override channel");
  });
});
