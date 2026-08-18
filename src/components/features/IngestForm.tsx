"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { FOCUS_RING } from "@/components/ui/styles";

const LANGUAGES = [
  { code: "es", native: "Español" },
  { code: "pt", native: "Português" },
];

const FIELD_LABEL = "font-mono text-[11px] uppercase tracking-widest text-muted";

export function IngestForm() {
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
    <Panel as="form" onSubmit={handleSubmit} className="flex flex-col gap-4 lg:h-fit">
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
            <Button
              key={l.code}
              type="button"
              variant="pill"
              active={language === l.code}
              onClick={() => setLanguage(l.code)}
              className="flex-1"
            >
              {l.native}
            </Button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Adding…" : "Add video"}
      </Button>

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
    </Panel>
  );
}
