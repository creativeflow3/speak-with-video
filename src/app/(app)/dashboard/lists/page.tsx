import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardUser } from "@/lib/authz";
import { listLists, type AnkiListSummary } from "@/lib/anki-list";
import { Panel } from "@/components/ui/panel";
import { FOCUS_RING, MONO_LABEL } from "@/components/ui/styles";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewListForm } from "@/components/features/dashboard/NewListForm";
import { DeleteListButton } from "@/components/features/dashboard/ListActions";
import { pluralize } from "@/lib/utils";
import { formatDate } from "@/components/features/dashboard/format";

export const metadata: Metadata = { title: "Lists" };

function ListRow({ list }: { list: AnkiListSummary }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
      <div className="min-w-0">
        <Link
          href={`/dashboard/lists/${list.id}`}
          className={`break-words rounded font-display text-xl italic text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
        >
          {list.name}
        </Link>
        <p className={`mt-1 ${MONO_LABEL}`}>
          {pluralize(list.itemCount, "word")} · Created {formatDate(list.createdAt)}
          {list.isDefault && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-ink">Default</span>}
        </p>
      </div>
      {!list.isDefault && <DeleteListButton listId={list.id} />}
    </li>
  );
}

export default async function ListsPage() {
  const user = await getDashboardUser("/dashboard/lists");
  const lists = await listLists(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lists"
        description="Words you save in Find a Phrase land in the list picked there. Default is always kept — clear its words instead of deleting it."
      />
      <Panel>
        <NewListForm />
      </Panel>
      <ul className="divide-y divide-line">
        {lists.map((list) => (
          <ListRow key={list.id} list={list} />
        ))}
      </ul>
    </div>
  );
}
