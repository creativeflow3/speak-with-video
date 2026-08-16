export interface AnkiCard {
  front: string;
  back: string;
  notes?: string;
}

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Formats cards as a CSV Anki can import directly (Front, Back, Notes columns). */
export function generateAnkiCsv(cards: AnkiCard[]): string {
  const header = ["Front", "Back", "Notes"].join(",");
  const rows = cards.map((card) =>
    [escapeField(card.front), escapeField(card.back), escapeField(card.notes ?? "")].join(","),
  );
  return [header, ...rows].join("\r\n");
}
