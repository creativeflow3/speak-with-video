import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { generateAnkiCsv } from "@/lib/anki/csv";
import { downloadAndClearList } from "@/lib/anki-list/items";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function downloadListTool(context: ToolContext) {
  return betaZodTool({
    name: "download_list",
    description: "Export the user's saved vocabulary list as a CSV and clear the list.",
    inputSchema: z.object({}),
    run: async () => {
      const items = await downloadAndClearList(context.userId);
      if (items.length === 0) {
        return "The list is empty — there's nothing to download.";
      }

      const csv = generateAnkiCsv(items);
      context.onExport("list_csv", { csv, cardCount: items.length });
      log("list_download", { userId: context.userId, cardCount: items.length });
      return `Exported and cleared ${items.length} saved item${items.length === 1 ? "" : "s"}.`;
    },
  });
}
