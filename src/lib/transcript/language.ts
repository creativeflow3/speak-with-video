import { franc } from "franc-min";
import { francCodeFor, isSupportedLanguage } from "@/lib/languages";

export interface LanguageCheckResult {
  matches: boolean;
  detected: string;
}

/** Builds a bounded text sample for language detection without joining the whole transcript. */
export function sampleForLanguageCheck(segments: { text: string }[], maxLength = 3000): string {
  let sample = "";
  for (const segment of segments) {
    sample += (sample ? " " : "") + segment.text;
    if (sample.length >= maxLength) break;
  }
  return sample.slice(0, maxLength);
}

// Detection runs unrestricted (not narrowed to es/pt) so text in some other language
// entirely is flagged as a mismatch rather than forced into the closest of the two.
export function checkTranscriptLanguage(text: string, expectedLanguage: string): LanguageCheckResult {
  if (!isSupportedLanguage(expectedLanguage)) return { matches: true, detected: "und" };

  const detected = franc(text);
  const expected = francCodeFor(expectedLanguage);
  return { matches: detected === "und" || detected === expected, detected };
}
