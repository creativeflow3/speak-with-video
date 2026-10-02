import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { searchClips } from "@/lib/clip-search";
import { distinctVideos } from "@/lib/retrieval-metrics";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/languages";
import { deepLinkUrl } from "@/lib/youtube";
import { log } from "@/lib/logger";
import type { ToolContext } from "./context";

export function searchRag(context: ToolContext) {
  return betaZodTool({
    name: "search_rag",
    description:
      "Search the ingested YouTube transcript database for real example usage of a word or phrase.",
    inputSchema: z.object({
      query: z.string().describe("The word or phrase to search for, e.g. 'vale la pena'"),
      // An enum, not a free string: the filter is an exact match on the stored code, so a
      // regional variant like "pt-BR" or "es-MX" would silently match zero chunks.
      language: z
        .enum(SUPPORTED_LANGUAGE_CODES)
        .optional()
        .describe("Optional language filter. Use the base code only (e.g. 'pt' for Brazilian Portuguese)."),
      topK: z.number().int().min(1).max(10).optional().describe("Number of results to return (default 5)"),
    }),
    run: async ({ query, language, topK }) => {
      const start = Date.now();
      const { matches, candidateCount, reranked, rerankMs } = await searchClips(query, {
        userId: context.userId,
        language,
        topK,
      });
      log("rag_query", {
        query,
        language,
        resultCount: matches.length,
        candidateCount,
        reranked,
        rerankMs,
        resultVideoCount: distinctVideos(matches),
        ms: Date.now() - start,
      });

      if (matches.length === 0) {
        return "No matching examples were found in the ingested videos.";
      }

      return matches
        .map(
          (m, i) =>
            `${i + 1}. "${m.text}"\n   Video: ${m.videoTitle} (${m.channel})\n   Link: ${deepLinkUrl(m.videoId, m.startTime)}`,
        )
        .join("\n\n");
    },
  });
}
