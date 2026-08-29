import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { embedQuery } from "@/lib/voyage";
import { queryChunks } from "@/lib/pinecone";
import { deepLinkUrl, parseVideoId } from "@/lib/youtube";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function searchRag(context: ToolContext) {
  return betaZodTool({
    name: "search_rag",
    description:
      "Search the ingested YouTube transcript database for real example usage of a word or phrase.",
    inputSchema: z.object({
      query: z.string().describe("The word or phrase to search for, e.g. 'vale la pena'"),
      language: z.string().optional().describe("Optional ISO language code filter, e.g. 'es'"),
      topK: z.number().int().min(1).max(10).optional().describe("Number of results to return (default 5)"),
    }),
    run: async ({ query, language, topK }) => {
      const start = Date.now();
      const vector = await embedQuery(query);
      const matches = await queryChunks(vector, { userId: context.userId, topK, language });
      log("rag_query", { query, language, resultCount: matches.length, ms: Date.now() - start });

      if (matches.length === 0) {
        return "No matching examples were found in the ingested videos.";
      }

      return matches
        .map((m, i) => {
          const videoId = parseVideoId(m.youtubeUrl);
          const link = videoId ? deepLinkUrl(videoId, m.startTime) : m.youtubeUrl;
          return `${i + 1}. "${m.text}"\n   Video: ${m.videoTitle} (${m.channel})\n   Link: ${link}`;
        })
        .join("\n\n");
    },
  });
}
