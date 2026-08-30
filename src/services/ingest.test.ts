import { describe, it, expect, vi, beforeEach } from "vitest";
import { videos, transcriptApiUsage } from "@/db/schema";
import {
  findVideoByVideoId,
  createVideo,
  markVideoPending,
  markVideoFailed,
  markVideoSucceeded,
  recordTranscriptApiUsage,
  type Video,
} from "./ingest.service";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  insertVideosValues: vi.fn(() => Promise.resolve(undefined)),
  insertUsageValues: vi.fn(() => Promise.resolve(undefined)),
  updateSet: vi.fn(() => ({ where: () => Promise.resolve(undefined) })),
}));

vi.mock("@/db", () => ({ db: mocks }));

function selectChain(rows: Video[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) };
}

beforeEach(() => {
  mocks.select.mockReset();
  mocks.insert.mockReset();
  mocks.update.mockReset();
  mocks.insertVideosValues.mockClear();
  mocks.insertUsageValues.mockClear();
  mocks.updateSet.mockClear();

  mocks.insert.mockImplementation((table) =>
    table === videos ? { values: mocks.insertVideosValues } : { values: mocks.insertUsageValues },
  );
  mocks.update.mockReturnValue({ set: mocks.updateSet });
});

describe("findVideoByVideoId", () => {
  it("returns the matching video", async () => {
    const row = { videoId: "abc", status: "succeeded" } as Video;
    mocks.select.mockReturnValue(selectChain([row]));

    const result = await findVideoByVideoId("abc");

    expect(result).toEqual(row);
  });

  it("returns undefined when no video matches", async () => {
    mocks.select.mockReturnValue(selectChain([]));

    const result = await findVideoByVideoId("missing");

    expect(result).toBeUndefined();
  });
});

describe("createVideo", () => {
  it("inserts a pending video row with the given ownership", async () => {
    await createVideo({
      videoId: "abc",
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
      language: "es",
      ownerId: "user-1",
      visibility: "private",
    });

    expect(mocks.insert).toHaveBeenCalledWith(videos);
    expect(mocks.insertVideosValues).toHaveBeenCalledWith({
      videoId: "abc",
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
      language: "es",
      status: "pending",
      ownerId: "user-1",
      visibility: "private",
    });
  });
});

describe("markVideoPending", () => {
  it("resets status to pending, updates the language, and clears the failure reason", async () => {
    await markVideoPending("abc", "pt");

    expect(mocks.update).toHaveBeenCalledWith(videos);
    expect(mocks.updateSet).toHaveBeenCalledWith({ status: "pending", language: "pt", failureReason: null });
  });
});

describe("markVideoFailed", () => {
  it("marks the video failed with the given reason", async () => {
    await markVideoFailed("abc", "Transcript unavailable");

    expect(mocks.update).toHaveBeenCalledWith(videos);
    expect(mocks.updateSet).toHaveBeenCalledWith({ status: "failed", failureReason: "Transcript unavailable" });
  });
});

describe("markVideoSucceeded", () => {
  it("marks the video succeeded, sets the derived fields, and clears the failure reason", async () => {
    await markVideoSucceeded("abc", { title: "Title", channel: "Channel", chunkCount: 5 });

    expect(mocks.update).toHaveBeenCalledWith(videos);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      status: "succeeded",
      title: "Title",
      channel: "Channel",
      chunkCount: 5,
      failureReason: null,
    });
  });
});

describe("recordTranscriptApiUsage", () => {
  it("records a successful call", async () => {
    await recordTranscriptApiUsage("abc", true);

    expect(mocks.insert).toHaveBeenCalledWith(transcriptApiUsage);
    expect(mocks.insertUsageValues).toHaveBeenCalledWith({ videoId: "abc", succeeded: true });
  });

  it("records a failed call", async () => {
    await recordTranscriptApiUsage("abc", false);

    expect(mocks.insertUsageValues).toHaveBeenCalledWith({ videoId: "abc", succeeded: false });
  });
});
