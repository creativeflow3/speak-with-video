import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { generateAnkiCsv } from "@/lib/anki";
import { exportList } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import { pluralize } from "@/lib/utils";
import type { ToolContext } from "./context";

export function downloadListTool(context: ToolContext) {
  return betaZodTool({
    name: "download_list",
    description: "Export the vocabulary list the user has selected in the app as a CSV. The list is kept as-is.",
    inputSchema: z.object({}),
    run: async () => {
      const { list, cards } = await exportList(context.userId, context.listId);
      if (cards.length === 0) {
        return `${list.name} is empty — there's nothing to download.`;
      }

      const csv = generateAnkiCsv(cards);
      context.onExport("list_csv", { csv, cardCount: cards.length });
      log("list_download", { userId: context.userId, listId: list.id, cardCount: cards.length });
      return `Exported ${pluralize(cards.length, "saved item")} from ${list.name}.`;
    },
  });
}
