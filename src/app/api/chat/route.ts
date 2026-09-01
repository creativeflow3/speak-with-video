import { NextResponse } from "next/server";
import { traceable } from "langsmith/traceable";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { requireSession } from "@/lib/authz";
import { searchRag } from "@/lib/tools/searchRag";
import { generateAnkiCsvTool } from "@/lib/tools/generateAnkiCsvTool";
import { addToListTool } from "@/lib/tools/addToListTool";
import { downloadListTool } from "@/lib/tools/downloadListTool";
import type { CsvExport } from "@/lib/tools/context";
import type { ChatMessage, ChatRequestBody } from "@/types";

const SYSTEM_PROMPT = `You are a language-learning research assistant. The user is building a personal database of YouTube video transcripts (currently Spanish and Portuguese) and wants to see how words or phrases are actually used by native speakers.

Tools:
- search_rag: searches the ingested transcript database for real usage examples of a word or phrase. Call it whenever the user asks about a specific word/phrase, wants example usage, or wants insights/patterns across multiple examples. Do not call it for general conversation unrelated to phrase usage. If it returns no results, say so plainly rather than inventing an example.
- generate_anki_csv: call this when the user asks to export flashcards/Anki cards for this conversation only (a one-off export), passing the front/back (and optional notes) for each card. The app delivers the actual downloadable file — after calling the tool, just confirm to the user that the cards were generated. Never write CSV content yourself in your reply.
- add_to_list: call this when the user asks to add a word/term/phrase to their (persistent, running) vocabulary list, e.g. "add vale la pena to my list". Confirm the addition briefly after calling it.
- download_list: call this when the user asks to download/export their saved vocabulary list. The app delivers the downloadable file and then clears the list. If the list is empty, tell the user instead of calling this tool.

When citing a search_rag result, include the video title and the YouTube link from the result so the user can watch the original context.`;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type ChatTurnInput = {
  query: string;
  history: ChatMessage[];
  userId: string;
  enqueue: (chunk: string) => void;
  pendingExports: { event: string; data: CsvExport }[];
  toolContext: {
    userId: string;
    onExport: (event: string, data: CsvExport) => void;
  };
};

// LangSmith records this as the trace's parent "chain" run. `toolRunner()` below
// captures a reference to the raw, unwrapped Anthropic client internally, so the
// wrapAnthropic() tracing in src/lib/anthropic.ts never fires for it — this span
// is what gives the tool-calling loop any tracing at all.
const runChatTurn = traceable(
  async (input: ChatTurnInput) => {
    const runner = anthropic.beta.messages.toolRunner({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        searchRag(input.toolContext),
        generateAnkiCsvTool(input.toolContext),
        addToListTool(input.toolContext),
        downloadListTool(input.toolContext),
      ],
      messages: [...input.history, { role: "user", content: input.query }],
      stream: true,
    });

    let responseText = "";
    const exportedEvents: string[] = [];

    for await (const messageStream of runner) {
      for await (const event of messageStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          responseText += event.delta.text;
          input.enqueue(sseEvent("text", { text: event.delta.text }));
        }
      }

      while (input.pendingExports.length > 0) {
        const { event, data } = input.pendingExports.shift()!;
        exportedEvents.push(event);
        input.enqueue(sseEvent(event, data));
      }
    }

    return { responseText, exportedEvents };
  },
  {
    name: "chat_turn",
    run_type: "chain",
    processInputs: ({ query, history, userId }: ChatTurnInput) => ({
      query,
      history,
      userId,
    }),
  },
);

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  let body: Partial<ChatRequestBody>;
  try {
    body = (await request.json()) as Partial<ChatRequestBody>;
  } catch {
    return new Response(
      JSON.stringify({ error: "Request body must be valid JSON" }),
      { status: 400 },
    );
  }
  if (!body.query) {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
    });
  }

  const history = (body.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const pendingExports: { event: string; data: CsvExport }[] = [];
  const toolContext = {
    userId: auth.id,
    onExport: (event: string, data: CsvExport) =>
      pendingExports.push({ event, data }),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      try {
        await runChatTurn({
          query: body.query!,
          history,
          userId: auth.id,
          enqueue,
          pendingExports,
          toolContext,
        });
        enqueue(sseEvent("done", {}));
      } catch (err) {
        enqueue(
          sseEvent("error", {
            message: err instanceof Error ? err.message : "Unknown error",
          }),
        );
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
