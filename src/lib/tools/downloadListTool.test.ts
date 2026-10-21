import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportList } from "@/lib/anki-list";
import { downloadListTool } from "./downloadListTool";
import { makeToolContext } from "./testUtils";

vi.mock("@/lib/anki-list", () => ({ exportList: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn() }));

const travelList = { id: "list-travel", name: "Travel", isDefault: false };

describe("downloadListTool", () => {
  beforeEach(() => {
    vi.mocked(exportList).mockReset();
  });

  it("reports an empty list without exporting anything", async () => {
    vi.mocked(exportList).mockResolvedValue({ list: travelList, cards: [] });
    const onExport = vi.fn();
    const tool = downloadListTool(makeToolContext(onExport));

    const result = await tool.run({});

    expect(onExport).not.toHaveBeenCalled();
    expect(result).toBe("Travel is empty — there's nothing to download.");
  });

  it("exports the selected list as CSV without describing it as cleared", async () => {
    vi.mocked(exportList).mockResolvedValue({
      list: travelList,
      cards: [
        { front: "vale la pena", back: "it's worth it" },
        { front: "de nada", back: "you're welcome" },
      ],
    });
    const onExport = vi.fn();
    const tool = downloadListTool(makeToolContext(onExport, { listId: "list-travel" }));

    const result = await tool.run({});

    expect(exportList).toHaveBeenCalledWith("user-1", "list-travel");
    expect(onExport).toHaveBeenCalledWith("list_csv", {
      csv: expect.stringContaining("vale la pena,it's worth it,"),
      cardCount: 2,
    });
    expect(result).toBe("Exported 2 saved items from Travel.");
  });
});
