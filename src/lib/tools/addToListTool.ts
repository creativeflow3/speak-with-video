import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { addListItem } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function addToListTool(context: ToolContext) {
  return betaZodTool({
    name: "add_to_list",
    description: "Add a word or phrase to the vocabulary list the user has selected in the app.",
    inputSchema: z.object({
      front: z.string(),
      back: z.string(),
      notes: z.string().optional(),
    }),
    run: async ({ front, back, notes }) => {
      const list = await addListItem(context.userId, { front, back, notes }, context.listId);
      log("list_add", { userId: context.userId, listId: list.id });
      return `Added "${front}" to ${list.name}.`;
    },
  });
}
