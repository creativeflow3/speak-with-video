"use client";

import { useRouter } from "next/navigation";
import { generateAnkiCsv, type AnkiCard } from "@/lib/anki";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/styles";
import { downloadCsv } from "../downloadCsv";
import { ActionError } from "./ActionError";
import { ConfirmAction } from "./ConfirmAction";
import { useApiAction } from "./useApiAction";

/** Deletes a whole (non-default) list, then goes back to the lists overview. */
export function DeleteListButton({ listId }: { listId: string }) {
  const router = useRouter();
  const { run, state } = useApiAction();

  async function deleteList() {
    const ok = await run(`/api/lists/${listId}`, { method: "DELETE" });
    if (ok) router.push("/dashboard/lists");
    return ok;
  }

  return <ConfirmAction labels={{ idle: "Delete list", confirm: "Confirm delete" }} onConfirm={deleteList} state={state} />;
}

/** Removes every word but keeps the list — the Default list's equivalent of deleting. */
export function ClearListButton({ listId }: { listId: string }) {
  const { run, state } = useApiAction();

  return (
    <ConfirmAction
      labels={{ idle: "Clear all words", confirm: "Confirm clear" }}
      onConfirm={() => run(`/api/lists/${listId}/items`, { method: "DELETE" })}
      state={state}
    />
  );
}

export function RemoveWordButton({ listId, itemId }: { listId: string; itemId: string }) {
  const { run, state } = useApiAction();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={state.pending}
        onClick={() => run(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" })}
        className={`rounded font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-danger disabled:opacity-50 ${FOCUS_RING}`}
      >
        {state.pending ? "Removing…" : "Remove"}
      </button>
      <ActionError error={state.error} />
    </div>
  );
}

function csvFilename(listName: string) {
  const slug = listName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "vocab-list"}.csv`;
}

/** Exports the list as an Anki-ready CSV; the words stay in the list. */
export function DownloadListButton({ listName, cards }: { listName: string; cards: AnkiCard[] }) {
  return (
    <Button
      variant="secondary"
      disabled={cards.length === 0}
      onClick={() => downloadCsv(generateAnkiCsv(cards), csvFilename(listName))}
      className="disabled:opacity-50"
    >
      ↓ Download CSV
    </Button>
  );
}
