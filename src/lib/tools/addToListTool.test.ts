import { describe, it, expect, vi, beforeEach } from "vitest";
import { addListItem } from "@/lib/anki-list/items";
import { addToListTool } from "./addToListTool";
import { makeToolContext } from "./testUtils";

vi.mock("@/lib/anki-list/items", () => ({ addListItem: vi.fn() }));

describe("addToListTool", () => {
  beforeEach(() => {
    vi.mocked(addListItem).mockReset();
  });

  it("adds the card under the context's userId and confirms", async () => {
    vi.mocked(addListItem).mockResolvedValue(undefined);
    const tool = addToListTool(makeToolContext());

    const result = await tool.run({ front: "vale la pena", back: "it's worth it", notes: "ep 3" });

    expect(addListItem).toHaveBeenCalledWith("user-1", {
      front: "vale la pena",
      back: "it's worth it",
      notes: "ep 3",
    });
    expect(result).toBe('Added "vale la pena" to the list.');
  });
});
