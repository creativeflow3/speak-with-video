// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import type { OwnedVideoJson, VideosPageResponse } from "@/types";
import { VideoList } from "./VideoList";

const fetchMock = mockFetch();
afterEach(cleanup);

beforeAll(() => {
  // jsdom has no layout, so it doesn't implement scrolling.
  Element.prototype.scrollIntoView = () => {};
});

function makeVideo(n: number): OwnedVideoJson {
  return {
    id: `v${n}`,
    title: `Episode ${n}`,
    channel: "Channel",
    language: "es",
    status: "succeeded",
    failureReason: null,
    chunkCount: 3,
    visibility: "private",
    youtubeUrl: `https://www.youtube.com/watch?v=${n}`,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Answers every /api/videos request with the page it asked for, out of `total` videos. */
function serveVideos(total: number) {
  fetchMock.mockImplementation((url: string) => {
    const params = new URL(url, "http://localhost").searchParams;
    const page = Number(params.get("page"));
    const limit = Number(params.get("limit")) as VideosPageResponse["limit"];
    const count = Math.max(0, Math.min(limit, total - (page - 1) * limit));
    const videos = Array.from({ length: count }, (_, i) => makeVideo((page - 1) * limit + i + 1));
    const body: VideosPageResponse = { videos, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

const requestedUrls = () => fetchMock.mock.calls.map(([url]) => url as string);

describe("VideoList", () => {
  it("loads the first page of 10 and says which videos are shown", async () => {
    serveVideos(115);
    render(<VideoList />);

    expect(await screen.findByText("Showing 1–10 of 115")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(requestedUrls()).toEqual(["/api/videos?page=1&limit=10"]);
  });

  it("moves to another page from the pager", async () => {
    serveVideos(115);
    render(<VideoList />);
    await screen.findByText("Showing 1–10 of 115");

    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));

    expect(await screen.findByText("Showing 11–20 of 115")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Episode 11" })).toBeInTheDocument();
  });

  it("goes back to page 1 when the per-page size changes", async () => {
    serveVideos(115);
    render(<VideoList />);
    await screen.findByText("Showing 1–10 of 115");
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("Showing 11–20 of 115");

    await userEvent.selectOptions(screen.getByLabelText("Per page"), "25");

    expect(await screen.findByText("Showing 1–25 of 115")).toBeInTheDocument();
    expect(requestedUrls().at(-1)).toBe("/api/videos?page=1&limit=25");
  });

  it("shows the empty state, with no pager, when there are no videos", async () => {
    serveVideos(0);
    render(<VideoList />);

    expect(await screen.findByRole("link", { name: "add one from the home page" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("shows the error and loads again on Retry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Something went wrong. Try again." }),
    });
    render(<VideoList />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");

    serveVideos(3);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Showing 1–3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
