import { IngestForm } from "@/components/features/IngestForm";
import { ChatPanel } from "@/components/features/ChatPanel";
import { auth0 } from "@/lib/auth0";
import { buttonClasses } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/styles";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-canvas px-6 py-16 text-ink">
        <div className="w-full max-w-sm text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Real phrases, real videos
          </p>
          <h1 className="mt-2 font-display text-4xl italic text-ink sm:text-5xl">
            Speak With Video
          </h1>
          <p className="mt-3 text-sm text-muted">
            Paste a video, then ask how a phrase actually gets used — straight
            from the transcript.
          </p>

          <div className="tick-rail mt-8 w-full" />

          <div className="mt-8 flex flex-col items-center gap-4">
            {/* Redirects to Auth0 to sign up */}
            <a href="/auth/login?screen_hint=signup" className={buttonClasses("accent", false, "w-full")}>
              Create an account
            </a>
            {/* Redirects to Auth0 to log in */}
            <a
              href="/auth/login"
              className={`text-sm text-muted underline-offset-4 hover:text-ink hover:underline ${FOCUS_RING} rounded`}
            >
              Already have an account? Log in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <header className="mx-auto w-full max-w-5xl px-6 pt-10">
        <p>
          Logged in as {session.user.email}. <a href="/auth/logout">Logout</a>
        </p>
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
      </header>

      <div className="tick-rail mx-auto mt-8 w-full max-w-5xl px-6" />

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <IngestForm />
        <ChatPanel />
      </main>
    </div>
  );
}
