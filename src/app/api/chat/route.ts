import { NextResponse } from "next/server";
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { embedQuery } from "@/lib/voyage";
import { queryChunks } from "@/lib/pinecone";
import { generateAnkiCsv, type AnkiCard } from "@/lib/anki/csv";
import { addListItem, downloadAndClearList } from "@/lib/anki-list/items";
import { deepLinkUrl, parseVideoId } from "@/lib/youtube";
import { log } from "@/lib/logger";
import { requireSession } from "@/lib/authz";

const SYSTEM_PROMPT = `You are a language-learning research assistant. The user is building a personal database of YouTube video transcripts (currently Spanish and Portuguese) and wants to see how words or phrases are actually used by native speakers.

Tools:
- search_rag: searches the ingested transcript database for real usage examples of a word or phrase. Call it whenever the user asks about a specific word/phrase, wants example usage, or wants insights/patterns across multiple examples. Do not call it for general conversation unrelated to phrase usage. If it returns no results, say so plainly rather than inventing an example.
- generate_anki_csv: call this when the user asks to export flashcards/Anki cards for this conversation only (a one-off export), passing the front/back (and optional notes) for each card. The app delivers the actual downloadable file — after calling the tool, just confirm to the user that the cards were generated. Never write CSV content yourself in your reply.
- add_to_list: call this when the user asks to add a word/term/phrase to their (persistent, running) vocabulary list, e.g. "add vale la pena to my list". Confirm the addition briefly after calling it.
- download_list: call this when the user asks to download/export their saved vocabulary list. The app delivers the downloadable file and then clears the list. If the list is empty, tell the user instead of calling this tool.

When citing a search_rag result, include the video title and the YouTube link from the result so the user can watch the original context.`;

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  query: string;
  messages?: ChatRequestMessage[];
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  let body: Partial<ChatRequestBody>;
  try {
    body = (await request.json()) as Partial<ChatRequestBody>;
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), { status: 400 });
  }
  if (!body.query) {
    return new Response(JSON.stringify({ error: "query is required" }), { status: 400 });
  }

  const history = (body.messages ?? []).map((m) => ({ role: m.role, content: m.content }));

  const pendingExports: { event: string; data: { csv: string; cardCount: number } }[] = [];

  const searchRag = betaZodTool({
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
      const matches = await queryChunks(vector, { userId: auth.id, topK, language });
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

  const generateAnkiCsvTool = betaZodTool({
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
      pendingExports.push({ event: "anki_csv", data: { csv, cardCount: cards.length } });
      log("anki_export", { cardCount: cards.length });
      return `Generated ${cards.length} card${cards.length === 1 ? "" : "s"}.`;
    },
  });

  const addToListTool = betaZodTool({
    name: "add_to_list",
    description: "Add a word or phrase to the user's persistent vocabulary list.",
    inputSchema: z.object({
      front: z.string(),
      back: z.string(),
      notes: z.string().optional(),
    }),
    run: async ({ front, back, notes }) => {
      await addListItem(auth.id, { front, back, notes });
      log("list_add", { userId: auth.id });
      return `Added "${front}" to the list.`;
    },
  });

  const downloadListTool = betaZodTool({
    name: "download_list",
    description: "Export the user's saved vocabulary list as a CSV and clear the list.",
    inputSchema: z.object({}),
    run: async () => {
      const items = await downloadAndClearList(auth.id);
      if (items.length === 0) {
        return "The list is empty — there's nothing to download.";
      }

      const csv = generateAnkiCsv(items);
      pendingExports.push({ event: "list_csv", data: { csv, cardCount: items.length } });
      log("list_download", { userId: auth.id, cardCount: items.length });
      return `Exported and cleared ${items.length} saved item${items.length === 1 ? "" : "s"}.`;
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        const runner = anthropic.beta.messages.toolRunner({
          model: CHAT_MODEL,
          max_tokens: 4096,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools: [searchRag, generateAnkiCsvTool, addToListTool, downloadListTool],
          messages: [...history, { role: "user", content: body.query! }],
          stream: true,
        });

        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              enqueue(sseEvent("text", { text: event.delta.text }));
            }
          }

          while (pendingExports.length > 0) {
            const { event, data } = pendingExports.shift()!;
            enqueue(sseEvent(event, data));
          }
        }

        enqueue(sseEvent("done", {}));
      } catch (err) {
        enqueue(sseEvent("error", { message: err instanceof Error ? err.message : "Unknown error" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
