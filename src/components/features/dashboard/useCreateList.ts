"use client";

import { useState } from "react";
import { validateListName } from "@/lib/list-names";
// Type-only, so none of the server-side list code reaches the client bundle.
import type { AnkiListRef } from "@/lib/anki-list";
import { useApiAction } from "./useApiAction";

/**
 * Validates locally first (same rule as the server), then creates the list, clears the
 * field, and hands the created list to `onCreated`.
 */
export function useCreateList(onCreated?: (list: AnkiListRef) => void) {
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, state } = useApiAction();

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateListName(name);
    setLocalError("error" in result ? result.error : null);
    if ("error" in result) return;

    const ok = await run(
      "/api/lists",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name }),
      },
      async (res) => {
        const { list } = (await res.json()) as { list?: AnkiListRef };
        if (list) onCreated?.(list);
      },
    );
    if (ok) setName("");
  }

  function reset() {
    setName("");
    setLocalError(null);
  }

  return { name, setName, submit, reset, pending: state.pending, error: localError ?? state.error };
}
