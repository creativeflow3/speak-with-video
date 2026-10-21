// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import { ClearListButton, DeleteListButton, DownloadListButton, RemoveWordButton } from "./ListActions";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = mockFetch();
const okResponse = { ok: true, json: () => Promise.resolve({}) };

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  router.refresh.mockReset();
  router.push.mockReset();
});

describe("DeleteListButton", () => {
  it("asks for confirmation before deleting", async () => {
    render(<DeleteListButton listId="l1" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete list" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    render(<DeleteListButton listId="l1" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete list" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete list" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the list and returns to the lists overview", async () => {
    fetchMock.mockResolvedValue(okResponse);
    render(<DeleteListButton listId="l1" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete list" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/lists/l1", { method: "DELETE" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/lists"));
  });

  it("shows the server's error and stays on the page", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: "Nope" }) });
    render(<DeleteListButton listId="l1" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete list" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("ClearListButton", () => {
  it("clears every word after confirmation and refreshes", async () => {
    fetchMock.mockResolvedValue(okResponse);
    render(<ClearListButton listId="l1" />);

    await userEvent.click(screen.getByRole("button", { name: "Clear all words" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm clear" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/lists/l1/items", { method: "DELETE" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});

describe("RemoveWordButton", () => {
  it("removes the word and refreshes", async () => {
    fetchMock.mockResolvedValue(okResponse);
    render(<RemoveWordButton listId="l1" itemId="i1" />);

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/lists/l1/items/i1", { method: "DELETE" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});

describe("DownloadListButton", () => {
  it("downloads the cards as a CSV named after the list", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DownloadListButton listName="Travel Phrases!" cards={[{ front: "hola", back: "hi" }]} />);

    await userEvent.click(screen.getByRole("button", { name: "↓ Download CSV" }));

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("travel-phrases.csv");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("is disabled for an empty list", () => {
    render(<DownloadListButton listName="Travel" cards={[]} />);

    expect(screen.getByRole("button", { name: "↓ Download CSV" })).toBeDisabled();
  });
});
