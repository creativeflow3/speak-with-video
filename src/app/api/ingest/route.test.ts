import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  findVideoByVideoId,
  createVideo,
  markVideoPending,
  markVideoFailed,
} from "@/services/ingest.service";
import { videoIngest, IngestValidationError } from "@/lib/video-ingest";
import { makeAuthedUser, makeJsonRequest } from "../testUtils";
import { POST } from "./route";
import type { Video } from "@/services/ingest.service";

vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMITS: { ingest: { route: "ingest" } },
}));
vi.mock("@/lib/logger", () => ({ log: vi.fn() }));
vi.mock("@/services/ingest.service", () => ({
  findVideoByVideoId: vi.fn(),
  createVideo: vi.fn(),
  markVideoPending: vi.fn(),
  markVideoFailed: vi.fn(),
}));
vi.mock("@/lib/video-ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-ingest")>();
  return { ...actual, videoIngest: vi.fn() };
});

const user = makeAuthedUser();

function makeRequest(body: unknown): Request {
  return makeJsonRequest("/api/ingest", body);
}

const validBody = { youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", language: "es" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(user);
  vi.mocked(checkRateLimit).mockResolvedValue(null);
  vi.mocked(findVideoByVideoId).mockResolvedValue(undefined);
  vi.mocked(createVideo).mockResolvedValue(undefined);
  vi.mocked(markVideoPending).mockResolvedValue(undefined);
  vi.mocked(markVideoFailed).mockResolvedValue(undefined);
  vi.mocked(videoIngest).mockResolvedValue({
    title: "Title",
    channel: "Channel",
    chunkCount: 3,
  } as Awaited<ReturnType<typeof videoIngest>>);
});

describe("POST /api/ingest", () => {
  it("returns the 401 from requireSession without touching rate limiting", async () => {
    const unauthed = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    const res = await POST(makeRequest(validBody));

    expect(res).toBe(unauthed);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns the 429 from checkRateLimit", async () => {
    const limited = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    vi.mocked(checkRateLimit).mockResolvedValue(limited);

    const res = await POST(makeRequest(validBody));

    expect(res).toBe(limited);
    expect(videoIngest).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be valid JSON" });
  });

  it.each([
    ["missing youtubeUrl", { language: "es" }, "youtubeUrl and language are required"],
    [
      "missing language",
      { youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" },
      "youtubeUrl and language are required",
    ],
    ["unsupported language", { ...validBody, language: "fr" }, 'Unsupported language "fr"'],
    [
      "non-YouTube URL",
      { youtubeUrl: "https://vimeo.com/12345", language: "es" },
      "Only YouTube URLs are supported",
    ],
    [
      "unparseable video ID",
      { youtubeUrl: "https://www.youtube.com/watch", language: "es" },
      "Could not parse a YouTube video ID from that URL",
    ],
  ])("returns 400 for %s", async (_case, body, error) => {
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("short-circuits with already_ingested when the video already succeeded", async () => {
    const existing = { videoId: "dQw4w9WgXcQ", status: "succeeded" } as Video;
    vi.mocked(findVideoByVideoId).mockResolvedValue(existing);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "already_ingested", video: existing });
    expect(createVideo).not.toHaveBeenCalled();
    expect(videoIngest).not.toHaveBeenCalled();
  });

  it("creates a new private video for a non-admin user and returns the ingest result", async () => {
    const res = await POST(makeRequest(validBody));

    expect(createVideo).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "dQw4w9WgXcQ", ownerId: "user-1", visibility: "private" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "succeeded",
      title: "Title",
      channel: "Channel",
      chunkCount: 3,
    });
  });

  it("creates a new base-visibility video for an admin user", async () => {
    vi.mocked(requireSession).mockResolvedValue(makeAuthedUser({ role: "Admin" }));

    await POST(makeRequest(validBody));

    expect(createVideo).toHaveBeenCalledWith(expect.objectContaining({ visibility: "base" }));
  });

  it("retries an existing failed video without reassigning ownership or visibility", async () => {
    const existing = {
      videoId: "dQw4w9WgXcQ",
      status: "failed",
      ownerId: "original-owner",
      visibility: "base",
    } as Video;
    vi.mocked(findVideoByVideoId).mockResolvedValue(existing);

    await POST(makeRequest(validBody));

    expect(markVideoPending).toHaveBeenCalledWith("dQw4w9WgXcQ", "es");
    expect(createVideo).not.toHaveBeenCalled();
    expect(videoIngest).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "original-owner", visibility: "base" }),
    );
  });

  it.each([
    [
      "an IngestValidationError",
      new IngestValidationError("Transcript unavailable", 422),
      422,
      "Transcript unavailable",
    ],
    ["a generic Error", new Error("boom"), 500, "boom"],
    ["a non-Error", "nope", 500, "Unknown error while processing transcript"],
  ])("marks the video failed when videoIngest rejects with %s", async (_case, rejection, status, error) => {
    vi.mocked(videoIngest).mockRejectedValue(rejection);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
    expect(markVideoFailed).toHaveBeenCalledWith("dQw4w9WgXcQ", error);
  });
});
