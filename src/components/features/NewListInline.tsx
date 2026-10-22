"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TEXT_INPUT, TEXT_LINK } from "@/components/ui/styles";
import { MAX_LIST_NAME_LENGTH } from "@/lib/list-names";
import type { AnkiListRef } from "@/lib/anki-list";
import { ActionError } from "./dashboard/ActionError";
import { useCreateList } from "./dashboard/useCreateList";

interface NewListInlineProps {
  onCreated: (list: AnkiListRef) => void;
}

/** A "+ New list" toggle that opens a one-line create form, for making a list without leaving the chat. */
export function NewListInline({ onCreated }: NewListInlineProps) {
  const [open, setOpen] = useState(false);
  const { name, setName, submit, reset, pending, error } = useCreateList((list) => {
    setOpen(false);
    onCreated(list);
  });

  function close() {
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`uppercase tracking-widest ${TEXT_LINK}`}>
        + New list
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex basis-full flex-col gap-1 normal-case tracking-normal">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label="New list name"
          value={name}
          maxLength={MAX_LIST_NAME_LENGTH}
          placeholder="e.g. Travel"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "chat-new-list-error" : undefined}
          className={`min-w-0 flex-1 py-1 ${TEXT_INPUT}`}
        />
        <Button type="submit" disabled={pending} className="py-1">
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
      <ActionError id="chat-new-list-error" error={error} />
    </form>
  );
}
