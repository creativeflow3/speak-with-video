import { IngestForm } from "@/components/features/IngestForm";
import { ChatPanel } from "@/components/features/ChatPanel";
import { Login } from "@/components/features/Login";
import { PageHeader } from "@/components/layout/PageHeader";
import { getSession, getSessionUser } from "@/lib/authz";
import { listListRefs, type AnkiListRef } from "@/lib/anki-list";
import { logRouteError } from "@/lib/logger";

/** The picker is a convenience — if lists can't load, chat still works and saves to Default. */
async function loadPickerLists(): Promise<AnkiListRef[]> {
  try {
    const user = await getSessionUser();
    return user ? await listListRefs(user.id) : [];
  } catch (err) {
    logRouteError("/", err);
    return [];
  }
}

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return <Login />;
  }

  const lists = await loadPickerLists();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Find a Phrase"
        description="Paste a video, then ask how a phrase actually gets used — straight from the transcript."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr] lg:gap-6">
        <IngestForm />
        <ChatPanel lists={lists} />
      </div>
    </div>
  );
}
