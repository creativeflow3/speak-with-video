import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkGuardrails } from "@/lib/guardrails";
import { toolDispatcher, type ChatTurnInput } from "@/lib/tool-dispatcher";
import { sseEvent } from "@/lib/utils";
import type { CsvExport } from "@/lib/tools/context";
import type { ChatRequestBody } from "@/types";

const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await checkRateLimit(auth.id, RATE_LIMITS.chat);
  if (limited) return limited;

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

  // The guardrail check runs alongside the first model call instead of before it,
  // saving its latency. Nothing reaches the client until it passes: model output
  // buffers in the unreturned stream, and tools wait on `toolsAllowed`.
  const guardrail = checkGuardrails(body.query, auth.id);
  const abort = new AbortController();
  const stream = startChatStream({
    query: body.query,
    history: (body.messages ?? []).slice(-MAX_HISTORY_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    userId: auth.id,
    toolsAllowed: guardrail.then((blocked) => !blocked, () => false),
  }, abort);

  const blocked = await guardrail;
  if (blocked) {
    abort.abort();
    return blocked;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

type ChatStreamInput = Pick<ChatTurnInput, "query" | "history" | "userId" | "toolsAllowed">;

/** Starts the model run immediately; its SSE output buffers until the stream is read. */
function startChatStream(input: ChatStreamInput, abort: AbortController): ReadableStream<Uint8Array> {
  const { signal } = abort;
  const encoder = new TextEncoder();
  const pendingExports: ChatTurnInput["pendingExports"] = [];
  const toolContext = {
    userId: input.userId,
    onExport: (event: string, data: CsvExport) => pendingExports.push({ event, data }),
  };

  return new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      try {
        await toolDispatcher({ ...input, signal, enqueue, pendingExports, toolContext });
        enqueue(sseEvent("done", {}));
      } catch (err) {
        if (!signal.aborted) {
          enqueue(sseEvent("error", { message: err instanceof Error ? err.message : "Unknown error" }));
        }
      }
      // An aborted stream was cancelled by the client or never returned — closing it would throw.
      if (!signal.aborted) controller.close();
    },
    cancel() {
      // Client went away — stop paying for tokens nobody will read.
      abort.abort();
    },
  });
}
