import { describe, it, expect } from "vitest";
import { generateAnkiCsv } from "./csv";

describe("generateAnkiCsv", () => {
  it("writes a header row plus one row per card", () => {
    const csv = generateAnkiCsv([
      { front: "vale la pena", back: "it's worth it" },
      { front: "de nada", back: "you're welcome" },
    ]);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("Front,Back,Notes");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("vale la pena,it's worth it,");
    expect(lines[2]).toBe("de nada,you're welcome,");
  });

  it("includes notes when provided", () => {
    const csv = generateAnkiCsv([
      { front: "vale la pena", back: "it's worth it", notes: "from ep. 3" },
    ]);
    expect(csv.split("\r\n")[1]).toBe("vale la pena,it's worth it,from ep. 3");
  });

  it("quotes fields containing a comma", () => {
    const csv = generateAnkiCsv([{ front: "hola, ¿qué tal?", back: "hi, how's it going?" }]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe('"hola, ¿qué tal?","hi, how\'s it going?",');
  });

  it("escapes embedded double quotes by doubling them", () => {
    const csv = generateAnkiCsv([{ front: 'dijo "vale la pena"', back: "said it's worth it" }]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe('"dijo ""vale la pena""",said it\'s worth it,');
  });

  it("quotes fields containing a newline", () => {
    const csv = generateAnkiCsv([{ front: "line one\nline two", back: "b" }]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe('"line one\nline two",b,');
  });

  it("returns just the header for an empty card list", () => {
    expect(generateAnkiCsv([])).toBe("Front,Back,Notes");
  });
});
