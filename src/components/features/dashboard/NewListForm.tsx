"use client";

import { Button } from "@/components/ui/button";
import { MONO_LABEL, TEXT_INPUT } from "@/components/ui/styles";
import { MAX_LIST_NAME_LENGTH } from "@/lib/list-names";
import { ActionError } from "./ActionError";
import { useCreateList } from "./useCreateList";

export function NewListForm() {
  const { name, setName, submit, pending, error } = useCreateList();

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="new-list-name" className={MONO_LABEL}>
        New list
      </label>
      <div className="flex gap-2">
        <input
          id="new-list-name"
          type="text"
          value={name}
          maxLength={MAX_LIST_NAME_LENGTH}
          placeholder="e.g. Travel"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-list-error" : undefined}
          className={`min-w-0 flex-1 ${TEXT_INPUT}`}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create list"}
        </Button>
      </div>
      <ActionError id="new-list-error" error={error} />
    </form>
  );
}
