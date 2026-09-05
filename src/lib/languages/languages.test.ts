import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES, isSupportedLanguage, francCodeFor } from "./languages";

describe("SUPPORTED_LANGUAGES", () => {
  it("includes Spanish and Portuguese", () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      { code: "es", native: "Español", francCode: "spa" },
      { code: "pt", native: "Português", francCode: "por" },
    ]);
  });
});

describe("isSupportedLanguage", () => {
  it("returns true for supported codes", () => {
    expect(isSupportedLanguage("es")).toBe(true);
    expect(isSupportedLanguage("pt")).toBe(true);
  });

  it("returns false for unsupported codes", () => {
    expect(isSupportedLanguage("en")).toBe(false);
    expect(isSupportedLanguage("")).toBe(false);
  });
});

describe("francCodeFor", () => {
  it("maps es to spa", () => {
    expect(francCodeFor("es")).toBe("spa");
  });

  it("maps pt to por", () => {
    expect(francCodeFor("pt")).toBe("por");
  });
});
