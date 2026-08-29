import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { addListItem } from "@/lib/anki-list/items";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function addToListTool(context: ToolContext) {
  return betaZodTool({
    name: "add_to_list",
    description: "Add a word or phrase to the user's persistent vocabulary list.",
    inputSchema: z.object({
      front: z.string(),
      back: z.string(),
      notes: z.string().optional(),
    }),
    run: async ({ front, back, notes }) => {
      await addListItem(context.userId, { front, back, notes });
      log("list_add", { userId: context.userId });
      return `Added "${front}" to the list.`;
    },
  });
}
