import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireSession } from "@/lib/authz";
import { logRouteError } from "@/lib/logger";
import { listOwnedVideosPage, type OwnedVideo } from "@/services/ingest.service";
import { unauthedResponse, makeAuthedUser } from "../testUtils";
import { GET } from "./route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/services/ingest.service", () => ({ listOwnedVideosPage: vi.fn() }));

const video: OwnedVideo = {
  id: "v1",
  title: "Episode 1",
  channel: "Channel",
  language: "es",
  status: "succeeded",
  failureReason: null,
  chunkCount: 12,
  visibility: "private",
  youtubeUrl: "https://www.youtube.com/watch?v=abc",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const get = (query = "") => GET(new Request(`http://localhost/api/videos${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
  vi.mocked(listOwnedVideosPage).mockResolvedValue({ videos: [video], total: 115 });
});

describe("GET /api/videos", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await get()).toBe(unauthed);
    expect(listOwnedVideosPage).not.toHaveBeenCalled();
  });

  it("defaults to the first page of 10", async () => {
    const res = await get();

    expect(listOwnedVideosPage).toHaveBeenCalledWith("user-1", { page: 1, limit: 10 });
    expect(await res.json()).toEqual({
      videos: [{ ...video, createdAt: "2026-01-01T00:00:00.000Z" }],
      page: 1,
      limit: 10,
      total: 115,
      totalPages: 12,
    });
  });

  it("passes the requested page and limit through", async () => {
    const res = await get("?page=2&limit=25");

    expect(listOwnedVideosPage).toHaveBeenCalledWith("user-1", { page: 2, limit: 25 });
    expect(await res.json()).toMatchObject({ page: 2, limit: 25, totalPages: 5 });
  });

  it("serves the last page when asked for one past the end", async () => {
    vi.mocked(listOwnedVideosPage)
      .mockResolvedValueOnce({ videos: [], total: 40 })
      .mockResolvedValueOnce({ videos: [video], total: 40 });

    const res = await get("?page=9&limit=10");

    expect(listOwnedVideosPage).toHaveBeenLastCalledWith("user-1", { page: 4, limit: 10 });
    expect(await res.json()).toMatchObject({ page: 4, totalPages: 4, videos: [expect.objectContaining({ id: "v1" })] });
  });

  it.each(["?limit=7", "?page=0", "?page=abc"])("returns 400 for %s", async (query) => {
    const res = await get(query);

    expect(res.status).toBe(400);
    expect(listOwnedVideosPage).not.toHaveBeenCalled();
  });

  it("logs and returns a 500 when the lookup fails", async () => {
    const failure = new Error("db down");
    vi.mocked(listOwnedVideosPage).mockRejectedValue(failure);

    const res = await get();

    expect(res.status).toBe(500);
    expect(logRouteError).toHaveBeenCalledWith("GET /api/videos", failure);
  });
});
