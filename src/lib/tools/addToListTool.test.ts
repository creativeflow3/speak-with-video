import { describe, it, expect, vi, beforeEach } from "vitest";
import { addListItem } from "@/lib/anki-list";
import { addToListTool } from "./addToListTool";
import { makeToolContext } from "./testUtils";

vi.mock("@/lib/anki-list", () => ({ addListItem: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn() }));

describe("addToListTool", () => {
  beforeEach(() => {
    vi.mocked(addListItem).mockReset();
  });

  it("adds the card to the context's selected list and names it in the confirmation", async () => {
    vi.mocked(addListItem).mockResolvedValue({ id: "list-travel", name: "Travel", isDefault: false });
    const tool = addToListTool(makeToolContext(vi.fn(), { listId: "list-travel" }));

    const result = await tool.run({ front: "vale la pena", back: "it's worth it", notes: "ep 3" });

    expect(addListItem).toHaveBeenCalledWith(
      "user-1",
      { front: "vale la pena", back: "it's worth it", notes: "ep 3" },
      "list-travel",
    );
    expect(result).toBe('Added "vale la pena" to Travel.');
  });

  it("passes no list id when none is selected, letting the server fall back to Default", async () => {
    vi.mocked(addListItem).mockResolvedValue({ id: "list-default", name: "Default", isDefault: true });
    const tool = addToListTool(makeToolContext());

    const result = await tool.run({ front: "hola", back: "hi" });

    expect(addListItem).toHaveBeenCalledWith("user-1", { front: "hola", back: "hi", notes: undefined }, undefined);
    expect(result).toBe('Added "hola" to Default.');
  });
});
