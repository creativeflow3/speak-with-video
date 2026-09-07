import { IngestForm } from "@/components/features/IngestForm";
import { ChatPanel } from "@/components/features/ChatPanel";
import { Login } from "@/components/features/Login";
import { Header } from "@/components/layout/Header";
import { auth0 } from "@/lib/auth0";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return <Login />;
  }

  const displayName = session.user.name ?? session.user.email ?? "there";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <Header displayName={displayName} />

      <div className="tick-rail mx-auto mt-8 w-full max-w-5xl px-6" />

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <IngestForm />
        <ChatPanel />
      </main>
    </div>
  );
}
