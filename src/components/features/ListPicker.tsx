"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FOCUS_RING, TEXT_LINK } from "@/components/ui/styles";
// Type-only, so none of the server-side list code reaches the client bundle.
import type { AnkiListRef as ListOption } from "@/lib/anki-list";

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
 * The list "Find a phrase" saves to: this visit's pick, else the remembered one, else Default.
 * A remembered id that's no longer in `lists` (deleted elsewhere) falls back to Default.
 */
export function useSelectedList(lists: ListOption[]): [string | undefined, (id: string) => void] {
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

interface ListPickerProps {
  lists: ListOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function ListPicker({ lists, selectedId, onSelect }: ListPickerProps) {
  if (lists.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-muted">
      <label htmlFor="chat-list-picker">Saving to</label>
      <select
        id="chat-list-picker"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className={`max-w-[12rem] truncate rounded-md border border-line bg-surface px-2 py-1 font-sans text-sm normal-case tracking-normal text-ink ${FOCUS_RING}`}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <Link href="/dashboard/lists" className={TEXT_LINK}>
        Manage lists →
      </Link>
    </div>
  );
}
