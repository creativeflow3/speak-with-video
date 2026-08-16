"use client";

import { useState } from "react";

const LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
];

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
        setMessage(data.error ?? "Ingestion failed");
        return;
      }

      if (data.status === "already_ingested") {
        setStatus("success");
        setMessage(`Already ingested: "${data.video?.title ?? youtubeUrl}"`);
        return;
      }

      setStatus("success");
      setMessage(`Ingested "${data.title}" — ${data.chunkCount} chunks indexed.`);
      setYoutubeUrl("");
    } catch {
      setStatus("error");
      setMessage("Network error while ingesting video");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Ingest a video</h2>
      <input
        type="text"
        placeholder="https://www.youtube.com/watch?v=..."
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        required
        className="rounded border px-3 py-2"
      />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="rounded border px-3 py-2"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {status === "loading" ? "Ingesting…" : "Ingest video"}
      </button>
      {message && (
        <p className={status === "error" ? "text-red-600" : "text-green-700"}>{message}</p>
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
    <div className="flex flex-1 flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Search &amp; chat</h2>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <p className="inline-block whitespace-pre-wrap rounded bg-gray-100 px-3 py-2">
              {m.content}
            </p>
          </div>
        ))}
      </div>
      {ankiCsv && (
        <button
          onClick={downloadCsv}
          className="self-start rounded bg-green-700 px-3 py-1.5 text-sm text-white"
        >
          Download Anki CSV ({ankiCsv.cardCount} cards)
        </button>
      )}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          placeholder='Try: "vale la pena"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Speak With Video</h1>
      <IngestForm />
      <ChatPanel />
    </main>
  );
}
