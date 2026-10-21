// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnkiListRef } from "@/lib/anki-list";
import { ListPicker, useSelectedList } from "./ListPicker";

const LISTS: AnkiListRef[] = [
  { id: "list-default", name: "Default", isDefault: true },
  { id: "list-travel", name: "Travel", isDefault: false },
];

function Harness({ lists = LISTS }: { lists?: AnkiListRef[] }) {
  const [selectedId, onSelect] = useSelectedList(lists);
  return <ListPicker lists={lists} selectedId={selectedId} onSelect={onSelect} />;
}

const picker = () => screen.getByLabelText("Saving to");

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it("renders nothing when there are no lists", () => {
    render(<Harness lists={[]} />);

    expect(screen.queryByLabelText("Saving to")).not.toBeInTheDocument();
  });
});
