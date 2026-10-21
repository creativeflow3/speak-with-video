"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MONO_LABEL, TEXT_INPUT } from "@/components/ui/styles";
import { MAX_LIST_NAME_LENGTH, validateListName } from "@/lib/list-names";
import { ActionError } from "./ActionError";
import { useApiAction } from "./useApiAction";

/** Validates locally first (same rule as the server), then creates the list and clears the field. */
function useCreateList() {
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, state } = useApiAction();

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateListName(name);
    setLocalError("error" in result ? result.error : null);
    if ("error" in result) return;

    const ok = await run("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: result.name }),
    });
    if (ok) setName("");
  }

  return { name, setName, submit, pending: state.pending, error: localError ?? state.error };
}

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
