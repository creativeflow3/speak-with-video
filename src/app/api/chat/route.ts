import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { toolDispatcher } from "@/lib/tool-dispatcher";
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

  const history = (body.messages ?? []).slice(-MAX_HISTORY_MESSAGES).map((m) => ({
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
        await toolDispatcher({
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
