import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadAndClearList } from "@/lib/anki-list/items";
import { downloadListTool } from "./downloadListTool";
import { makeToolContext } from "./testUtils";

vi.mock("@/lib/anki-list/items", () => ({ downloadAndClearList: vi.fn() }));

describe("downloadListTool", () => {
  beforeEach(() => {
    vi.mocked(downloadAndClearList).mockReset();
  });

  it("reports an empty list without exporting anything", async () => {
    vi.mocked(downloadAndClearList).mockResolvedValue([]);
    const onExport = vi.fn();
    const tool = downloadListTool(makeToolContext(onExport));

    const result = await tool.run({});

    expect(onExport).not.toHaveBeenCalled();
    expect(result).toBe("The list is empty — there's nothing to download.");
  });

  it("exports the CSV and clears the list when items exist", async () => {
    vi.mocked(downloadAndClearList).mockResolvedValue([
      { front: "vale la pena", back: "it's worth it" },
      { front: "de nada", back: "you're welcome" },
    ]);
    const onExport = vi.fn();
    const tool = downloadListTool(makeToolContext(onExport));

    const result = await tool.run({});

    expect(onExport).toHaveBeenCalledWith("list_csv", {
      csv: expect.stringContaining("vale la pena,it's worth it,"),
      cardCount: 2,
    });
    expect(result).toBe("Exported and cleared 2 saved items.");
  });
});
