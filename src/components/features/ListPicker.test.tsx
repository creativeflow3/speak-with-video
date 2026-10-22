// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnkiListRef } from "@/lib/anki-list";
import { mockFetch } from "@/components/testUtils";
import { ListPicker, useListPicker } from "./ListPicker";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const fetchMock = mockFetch();

const LISTS: AnkiListRef[] = [
  { id: "list-default", name: "Default", isDefault: true },
  { id: "list-travel", name: "Travel", isDefault: false },
];

function Harness({ lists = LISTS }: { lists?: AnkiListRef[] }) {
  return <ListPicker picker={useListPicker(lists)} />;
}

const picker = () => screen.getByLabelText("Saving to");

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockReset();
});

describe("ListPicker", () => {
  it("starts on the Default list and links to list management", () => {
    render(<Harness />);

    expect(picker()).toHaveValue("list-default");
    expect(screen.getByRole("link", { name: "Manage lists →" })).toHaveAttribute("href", "/dashboard/lists");
  });

  it("remembers the chosen list across visits", async () => {
    const { unmount } = render(<Harness />);
    await userEvent.selectOptions(picker(), "list-travel");
    unmount();

    render(<Harness />);

    expect(picker()).toHaveValue("list-travel");
  });

  it("falls back to Default when the remembered list no longer exists", () => {
    window.localStorage.setItem("swv:chat-list-id", "list-deleted");

    render(<Harness />);

    expect(picker()).toHaveValue("list-default");
  });

  it("still works when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Harness />);

    await userEvent.selectOptions(picker(), "list-travel");

    expect(picker()).toHaveValue("list-travel");
  });

  it("selects a list created inline, before the page refresh brings it in", async () => {
    const created = { id: "list-food", name: "Food", isDefault: false };
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ list: created }) });
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "+ New list" }));
    await userEvent.type(screen.getByLabelText("New list name"), "Food");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("option", { name: "Food" })).toBeInTheDocument();
    expect(picker()).toHaveValue("list-food");
    expect(refresh).toHaveBeenCalled();
  });

  it("renders nothing when there are no lists", () => {
    render(<Harness lists={[]} />);

    expect(screen.queryByLabelText("Saving to")).not.toBeInTheDocument();
  });
});
