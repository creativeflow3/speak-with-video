import { describe, it, expect, vi } from "vitest";
import { generateAnkiCsvTool } from "./generateAnkiCsvTool";
import { makeToolContext } from "./testUtils";

describe("generateAnkiCsvTool", () => {
  it("generates a CSV, calls onExport, and returns a plural confirmation", async () => {
    const onExport = vi.fn();
    const tool = generateAnkiCsvTool(makeToolContext(onExport));

    const result = await tool.run({
      cards: [
        { front: "vale la pena", back: "it's worth it" },
        { front: "de nada", back: "you're welcome" },
      ],
    });

    expect(onExport).toHaveBeenCalledWith("anki_csv", {
      csv: expect.stringContaining("Front,Back,Notes"),
      cardCount: 2,
    });
    expect(result).toBe("Generated 2 cards.");
  });

  it("uses singular phrasing for exactly one card", async () => {
    const tool = generateAnkiCsvTool(makeToolContext());

    const result = await tool.run({ cards: [{ front: "hola", back: "hi" }] });

    expect(result).toBe("Generated 1 card.");
  });
});
