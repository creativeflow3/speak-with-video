"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NETWORK_ERROR, errorMessageFor } from "../apiErrors";

export interface ApiActionState {
  pending: boolean;
  error: string | null;
}

/**
 * Calls one of the dashboard's API routes, tracking pending/error state, and
 * re-renders the server page on success so it shows the new data.
 */
export function useApiAction() {
  const router = useRouter();
  const [state, setState] = useState<ApiActionState>({ pending: false, error: null });

  async function run(url: string, init: RequestInit): Promise<boolean> {
    setState({ pending: true, error: null });
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        setState({ pending: false, error: await errorMessageFor(res) });
        return false;
      }
      setState({ pending: false, error: null });
      router.refresh();
      return true;
    } catch {
      setState({ pending: false, error: NETWORK_ERROR });
      return false;
    }
  }

  return { run, state };
}
