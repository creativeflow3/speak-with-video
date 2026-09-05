export const SUPPORTED_LANGUAGES = [
  { code: "es", native: "Español", francCode: "spa" },
  { code: "pt", native: "Português", francCode: "por" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

export function francCodeFor(code: SupportedLanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)!.francCode;
}
