import { describe, it, expect } from "vitest";
import { checkTranscriptLanguage, sampleForLanguageCheck } from "./language";

const SPANISH_TEXT =
  "Dices que como que puede ser un hito que te motiva a continuar. No se vale en el presupuesto, pero tiene mucho sentido para todos nosotros hoy.";
const PORTUGUESE_TEXT =
  "Hoje você vai aprender português brasileiro enquanto fazemos uma atividade muito relaxante, colorindo um desenho bem bonito.";
const ENGLISH_TEXT =
  "The quick brown fox jumps over the lazy dog while the sun sets over the quiet hills in the distance, and everyone watches in silence.";

describe("checkTranscriptLanguage", () => {
  it("matches Spanish text against the 'es' code", () => {
    const result = checkTranscriptLanguage(SPANISH_TEXT, "es");
    expect(result.matches).toBe(true);
    expect(result.detected).toBe("spa");
  });

  it("matches Portuguese text against the 'pt' code", () => {
    const result = checkTranscriptLanguage(PORTUGUESE_TEXT, "pt");
    expect(result.matches).toBe(true);
    expect(result.detected).toBe("por");
  });

  it("rejects Spanish text claimed as Portuguese", () => {
    const result = checkTranscriptLanguage(SPANISH_TEXT, "pt");
    expect(result.matches).toBe(false);
    expect(result.detected).toBe("spa");
  });

  it("rejects English text claimed as Spanish", () => {
    const result = checkTranscriptLanguage(ENGLISH_TEXT, "es");
    expect(result.matches).toBe(false);
    expect(result.detected).toBe("eng");
  });

  it("does not reject undetermined (too short) text", () => {
    const result = checkTranscriptLanguage("ok", "es");
    expect(result.matches).toBe(true);
    expect(result.detected).toBe("und");
  });

  it("does not reject an unsupported expected-language code", () => {
    const result = checkTranscriptLanguage(SPANISH_TEXT, "fr");
    expect(result.matches).toBe(true);
  });
});

describe("sampleForLanguageCheck", () => {
  it("joins segment text with spaces", () => {
    const segments = [{ text: "uno" }, { text: "dos" }, { text: "tres" }];
    expect(sampleForLanguageCheck(segments)).toBe("uno dos tres");
  });

  it("stops accumulating once maxLength is reached instead of joining every segment", () => {
    const segments = [{ text: "a".repeat(10) }, { text: "b".repeat(10) }, { text: "c".repeat(10) }];
    const sample = sampleForLanguageCheck(segments, 15);

    expect(sample.length).toBe(15);
    expect(sample).not.toContain("c");
  });

  it("returns an empty string for no segments", () => {
    expect(sampleForLanguageCheck([])).toBe("");
  });
});
