"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SELECT_INPUT, TEXT_LINK } from "@/components/ui/styles";
// Type-only, so none of the server-side list code reaches the client bundle.
import type { AnkiListRef as ListOption } from "@/lib/anki-list";
import { NewListInline } from "./NewListInline";

const STORAGE_KEY = "swv:chat-list-id";

// Storage can throw (private mode, blocked site data) — the picker then just starts on Default.
function readStoredListId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredListId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not remembering the choice is fine; it still applies for this visit.
  }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * The list "Find a Phrase" saves to: this visit's pick, else the remembered one, else Default.
 * A remembered id that's no longer in `lists` (deleted elsewhere) falls back to Default.
 */
function useSelectedList(lists: ListOption[]): [string | undefined, (id: string) => void] {
  const stored = useSyncExternalStore(subscribeToStorage, readStoredListId, () => null);
  const [picked, setPicked] = useState<string | null>(null);

  const candidate = picked ?? stored;
  const selected = lists.find((list) => list.id === candidate) ?? lists.find((list) => list.isDefault);

  function select(id: string) {
    setPicked(id);
    writeStoredListId(id);
  }

  return [selected?.id, select];
}

export interface ListPickerState {
  lists: ListOption[];
  selectedId: string | undefined;
  select: (id: string) => void;
  /** Adds a just-created list and selects it, before the server's refreshed `lists` include it. */
  addCreated: (list: ListOption) => void;
}

export function useListPicker(serverLists: ListOption[]): ListPickerState {
  const [created, setCreated] = useState<ListOption[]>([]);
  const lists = [...serverLists, ...created.filter((c) => !serverLists.some((l) => l.id === c.id))];
  const [selectedId, select] = useSelectedList(lists);

  function addCreated(list: ListOption) {
    setCreated((prev) => [...prev, list]);
    select(list.id);
  }

  return { lists, selectedId, select, addCreated };
}

export function ListPicker({ picker }: { picker: ListPickerState }) {
  const { lists, selectedId, select, addCreated } = picker;
  if (lists.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-muted">
      <label htmlFor="chat-list-picker">Saving to</label>
      <select
        id="chat-list-picker"
        value={selectedId}
        onChange={(e) => select(e.target.value)}
        className={`max-w-[12rem] truncate ${SELECT_INPUT}`}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <NewListInline onCreated={addCreated} />
      <Link href="/dashboard/lists" className={TEXT_LINK}>
        Manage lists →
      </Link>
    </div>
  );
}
