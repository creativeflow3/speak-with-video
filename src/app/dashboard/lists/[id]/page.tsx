import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardUser } from "@/lib/authz";
import { getListWithItems, ListNotFoundError, type AnkiListItem, type AnkiListRef } from "@/lib/anki-list";
import { MONO_LABEL, TEXT_LINK } from "@/components/ui/styles";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import {
  ClearListButton,
  DeleteListButton,
  DownloadListButton,
  RemoveWordButton,
} from "@/components/features/dashboard/ListActions";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "List" };

/** Someone else's list, a deleted one, or a malformed id all render the same 404. */
async function loadList(userId: string, id: string): Promise<{ list: AnkiListRef; items: AnkiListItem[] }> {
  try {
    return await getListWithItems(userId, id);
  } catch (err) {
    if (err instanceof ListNotFoundError) notFound();
    throw err;
  }
}

function WordRow({ listId, item }: { listId: string; item: AnkiListItem }) {
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
      <p className="break-words font-medium text-ink">{item.front}</p>
      <div className="min-w-0">
        <p className="break-words text-sm text-ink">{item.back}</p>
        {item.notes && <p className="mt-1 break-words text-xs text-muted">{item.notes}</p>}
      </div>
      <div className="sm:justify-self-end">
        <RemoveWordButton listId={listId} itemId={item.id} />
      </div>
    </li>
  );
}

function EmptyList() {
  return (
    <p className="py-10 text-center text-sm text-muted">
      No words yet. Pick this list in{" "}
      <Link href="/" className={`text-ink underline ${TEXT_LINK}`}>
        Find a phrase
      </Link>{" "}
      and ask to add a word.
    </p>
  );
}

export default async function ListPage({ params }: PageProps<"/dashboard/lists/[id]">) {
  const { id } = await params;
  const user = await getDashboardUser(`/dashboard/lists/${id}`);
  const { list, items } = await loadList(user.id, id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/lists" className={`self-start ${MONO_LABEL} ${TEXT_LINK}`}>
        ← All lists
      </Link>
      <DashboardPageHeader
        title={list.name}
        description={pluralize(items.length, "word")}
        actions={<DownloadListButton listName={list.name} cards={items} />}
      />
      {items.length === 0 ? (
        <EmptyList />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <WordRow key={item.id} listId={list.id} item={item} />
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t border-line pt-4">
        {list.isDefault ? <ClearListButton listId={list.id} /> : <DeleteListButton listId={list.id} />}
      </div>
    </div>
  );
}
