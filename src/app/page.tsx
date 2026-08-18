"use client";

import { useState } from "react";

const LANGUAGES = [
  { code: "es", native: "Español" },
  { code: "pt", native: "Português" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
const ACCENT_BUTTON = `rounded-lg bg-accent px-4 py-2 text-sm font-mono font-semibold uppercase tracking-wide text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${FOCUS_RING}`;
const FIELD_LABEL = "font-mono text-[11px] uppercase tracking-widest text-muted";
const PANEL = "rounded-2xl border border-line bg-surface p-5";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SseFrame {
  event: string;
  data: string;
}

function parseSseChunk(buffer: string): { frames: SseFrame[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const frames: SseFrame[] = [];

  for (const part of parts) {
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice("event: ".length);
      if (line.startsWith("data: ")) data = line.slice("data: ".length);
    }
    if (data) frames.push({ event, data });
  }

  return { frames, rest };
}

function IngestForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("es");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl, language }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "That video couldn't be added.");
        return;
      }

      if (data.status === "already_ingested") {
        setStatus("success");
        setMessage(`Already added: "${data.video?.title ?? youtubeUrl}"`);
        return;
      }

      setStatus("success");
      setMessage(`Added "${data.title}" — ${data.chunkCount} phrases indexed.`);
      setYoutubeUrl("");
    } catch {
      setStatus("error");
      setMessage("Network error — the video wasn't added. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-4 lg:h-fit ${PANEL}`}>
      <div>
        <h2 className="font-display text-xl italic text-ink">Add a video</h2>
        <p className="mt-1 text-sm text-muted">
          Drop in a YouTube link and we&apos;ll pull out every phrase.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="youtube-url" className={FIELD_LABEL}>
          YouTube URL
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-accent"
          >
            ▶
          </span>
          <input
            id="youtube-url"
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            required
            className={`w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink ${FOCUS_RING}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Language</span>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              aria-pressed={language === l.code}
              className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${FOCUS_RING} ${
                language === l.code
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-surface text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" disabled={status === "loading"} className={ACCENT_BUTTON}>
        {status === "loading" ? "Adding…" : "Add video"}
      </button>

      {message && (
        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            status === "error"
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-success/30 bg-success/5 text-success"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ankiCsv, setAnkiCsv] = useState<{ csv: string; cardCount: number } | null>(null);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    setAnkiCsv(null);

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
            } else if (frame.event === "anki_csv") {
              setAnkiCsv(JSON.parse(frame.data));
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

  function downloadCsv() {
    if (!ankiCsv) return;
    const blob = new Blob([ankiCsv.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anki-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`flex flex-1 flex-col gap-4 lg:min-h-[520px] ${PANEL}`}>
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

      {ankiCsv && (
        <button
          onClick={downloadCsv}
          className={`self-start rounded-full bg-secondary px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wide text-secondary-ink transition-opacity hover:opacity-90 ${FOCUS_RING}`}
        >
          ↓ Export {ankiCsv.cardCount} cards to Anki
        </button>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          placeholder='Try: "vale la pena"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink ${FOCUS_RING}`}
        />
        <button type="submit" disabled={loading} className={ACCENT_BUTTON}>
          {loading ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <header className="mx-auto w-full max-w-5xl px-6 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Real phrases, real videos
        </p>
        <h1 className="mt-2 font-display text-4xl italic text-ink sm:text-5xl">
          Speak With Video
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Paste a video, then ask how a phrase actually gets used — straight from the
          transcript.
        </p>
      </header>

      <div className="tick-rail mx-auto mt-8 w-full max-w-5xl px-6" />

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <IngestForm />
        <ChatPanel />
      </main>
    </div>
  );
}
