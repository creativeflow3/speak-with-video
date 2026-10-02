"use client";

import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { FOCUS_RING } from "@/components/ui/styles";
import { splitYouTubeLinks } from "@/lib/youtube";
import { parseSseChunk } from "@/lib/utils";
import type { ChatMessage, SseFrame } from "@/types";

interface CsvExport {
  csv: string;
  cardCount: number;
}

const CSV_EXPORT_CONFIG: Record<string, { filename: string; label: (cardCount: number) => string }> = {
  anki_csv: { filename: "anki-export.csv", label: (n) => `↓ Export ${n} cards to Anki` },
  list_csv: { filename: "vocab-list.csv", label: (n) => `↓ Download list (${n})` },
};

// Shown while a tool runs, keyed by the tool name in the server's `status` event.
const TOOL_STATUS: Record<string, string> = {
  search_rag: "Searching your videos…",
  generate_anki_csv: "Building flashcards…",
  add_to_list: "Adding to your list…",
  download_list: "Preparing your list…",
};

const LinkedText = memo(function LinkedText({ text }: { text: string }) {
  return splitYouTubeLinks(text).map((segment, i) =>
    segment.type === "link" ? (
      <a
        key={i}
        href={segment.value}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-all underline decoration-accent underline-offset-2 hover:opacity-80 ${FOCUS_RING}`}
      >
        {segment.value}
      </a>
    ) : (
      segment.value
    ),
  );
});

/** Reads an SSE response body to the end, handing each complete frame to `onFrame`. */
async function readSseFrames(body: ReadableStream<Uint8Array>, onFrame: (frame: SseFrame) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseChunk(buffer);
    buffer = rest;
    frames.forEach(onFrame);
  }
}

async function errorTextFor(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  if (data.error) return data.error;
  return res.status === 429
    ? "You're sending messages too quickly. Wait a bit and try again."
    : "Something went wrong reaching the server. Try sending that again.";
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvExports, setCsvExports] = useState<Record<string, CsvExport>>({});
  const [status, setStatus] = useState<string | null>(null);

  function setAssistantReply(content: string) {
    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);
  }

  function makeFrameHandler() {
    let assistantText = "";
    return (frame: SseFrame) => {
      if (frame.event === "text") {
        assistantText += (JSON.parse(frame.data) as { text: string }).text;
        setStatus(null);
        setAssistantReply(assistantText);
      } else if (frame.event === "status") {
        const { tool } = JSON.parse(frame.data) as { tool: string };
        setStatus(TOOL_STATUS[tool] ?? "Working…");
      } else if (frame.event in CSV_EXPORT_CONFIG) {
        setCsvExports((prev) => ({ ...prev, [frame.event]: JSON.parse(frame.data) as CsvExport }));
      }
    };
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: query }, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    setCsvExports({});

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages: history }),
      });
      if (!res.ok) setAssistantReply(await errorTextFor(res));
      else if (res.body) await readSseFrames(res.body, makeFrameHandler());
    } catch {
      setAssistantReply("Something went wrong reaching the server. Try sending that again.");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel className="flex flex-1 flex-col gap-4 lg:min-h-[520px]">
      <div>
        <h2 className="font-display text-xl italic text-ink">Find a phrase</h2>
        <p className="mt-1 text-sm text-muted">
          Ask how something is really said — we&apos;ll pull it from the videos you&apos;ve
          added.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-line bg-canvas/40 p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-xs text-sm text-muted">
              Try asking{" "}
              <span className="font-mono text-ink">&ldquo;vale la pena&rdquo;</span> — see how
              it&apos;s actually used.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.role === "user"
                      ? "rounded-br-sm bg-ink text-canvas"
                      : "rounded-bl-sm border border-line bg-surface text-ink"
                  }`}
                >
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest opacity-60">
                    {m.role === "user" ? "You" : "Guide"}
                  </span>
                  {m.content && (
                    <p className="whitespace-pre-wrap text-sm">
                      <LinkedText text={m.content} />
                    </p>
                  )}
                  {loading && i === messages.length - 1 && (status || !m.content) && (
                    <p role="status" className="animate-pulse text-sm italic text-muted">
                      {status ?? "Thinking…"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {Object.keys(csvExports).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(csvExports).map(([event, data]) => (
            <Button
              key={event}
              variant="secondary"
              onClick={() => downloadCsv(data.csv, CSV_EXPORT_CONFIG[event].filename)}
              className="self-start"
            >
              {CSV_EXPORT_CONFIG[event].label(data.cardCount)}
            </Button>
          ))}
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          placeholder='Try: "vale la pena"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink ${FOCUS_RING}`}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "…" : "Send"}
        </Button>
      </form>
    </Panel>
  );
}
