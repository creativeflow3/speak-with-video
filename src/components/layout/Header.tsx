import { FOCUS_RING } from "@/components/ui/styles";

interface HeaderProps {
  displayName: string;
}

export function Header({ displayName }: HeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between lg:px-6 lg:pt-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Real phrases, real videos
        </p>
        <h1 className="mt-2 font-display text-4xl italic text-ink sm:text-5xl">
          Speak With Video
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Paste a video, then ask how a phrase actually gets used — straight
          from the transcript.
        </p>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted sm:pt-1">
        <span className="text-ink">Welcome, {displayName}</span>
        <span aria-hidden className="text-line">
          ·
        </span>
        <a
          href="/auth/logout"
          className={`normal-case tracking-normal text-muted underline-offset-4 hover:text-ink hover:underline ${FOCUS_RING} rounded`}
        >
          Log out
        </a>
      </div>
    </header>
  );
}
