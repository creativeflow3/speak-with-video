import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { generateAnkiCsv, type AnkiCard } from "@/lib/anki/csv";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function generateAnkiCsvTool(context: ToolContext) {
  return betaZodTool({
    name: "generate_anki_csv",
    description: "Generate an Anki-importable CSV from a list of flashcards.",
    inputSchema: z.object({
      cards: z
        .array(
          z.object({
            front: z.string(),
            back: z.string(),
            notes: z.string().optional(),
          }),
        )
        .min(1),
    }),
    run: async ({ cards }) => {
      const csv = generateAnkiCsv(cards as AnkiCard[]);
      context.onExport("anki_csv", { csv, cardCount: cards.length });
      log("anki_export", { cardCount: cards.length });
      return `Generated ${cards.length} card${cards.length === 1 ? "" : "s"}.`;
    },
  });
}
