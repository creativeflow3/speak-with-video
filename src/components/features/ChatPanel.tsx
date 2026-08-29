"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { FOCUS_RING } from "@/components/ui/styles";
import { parseSseChunk } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface CsvExport {
  csv: string;
  cardCount: number;
}

const CSV_EXPORT_CONFIG: Record<string, { filename: string; label: (cardCount: number) => string }> = {
  anki_csv: { filename: "anki-export.csv", label: (n) => `↓ Export ${n} cards to Anki` },
  list_csv: { filename: "vocab-list.csv", label: (n) => `↓ Download list (${n})` },
};

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvExports, setCsvExports] = useState<Record<string, CsvExport>>({});

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    setCsvExports({});

    let assistantText = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages: history }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { frames, rest } = parseSseChunk(buffer);
          buffer = rest;

          for (const frame of frames) {
            if (frame.event === "text") {
              const { text } = JSON.parse(frame.data) as { text: string };
              assistantText += text;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantText };
                return next;
              });
            } else if (frame.event in CSV_EXPORT_CONFIG) {
              const data = JSON.parse(frame.data) as CsvExport;
              setCsvExports((prev) => ({ ...prev, [frame.event]: data }));
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong reaching the server. Try sending that again.",
        };
        return next;
      });
    } finally {
      setLoading(false);
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
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
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
