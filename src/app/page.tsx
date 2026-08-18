import { IngestForm } from "@/components/features/IngestForm";
import { ChatPanel } from "@/components/features/ChatPanel";

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
