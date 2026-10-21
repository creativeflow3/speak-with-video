"use client";

import { useState } from "react";
import { FOCUS_RING } from "@/components/ui/styles";
import { ActionError } from "./ActionError";
import type { ApiActionState } from "./useApiAction";

interface ConfirmActionProps {
  /** `idle` is the first button; `confirm` replaces it and runs the action. */
  labels: { idle: string; confirm: string };
  onConfirm: () => Promise<boolean>;
  state: ApiActionState;
}

const ACTION_CLASSES = `rounded font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-50 ${FOCUS_RING}`;

/** A destructive action that asks once inline ("Delete" → "Confirm delete / Cancel") instead of a browser dialog. */
export function ConfirmAction({ labels, onConfirm, state }: ConfirmActionProps) {
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    if (!(await onConfirm())) setConfirming(false);
  }

  const idleButton = (
    <button type="button" onClick={() => setConfirming(true)} className={`text-muted hover:text-danger ${ACTION_CLASSES}`}>
      {labels.idle}
    </button>
  );
  const confirmButtons = (
    <span className="flex items-center gap-3">
      <button type="button" onClick={confirm} disabled={state.pending} className={`text-danger ${ACTION_CLASSES}`}>
        {state.pending ? "Working…" : labels.confirm}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={state.pending} className={`text-muted ${ACTION_CLASSES}`}>
        Cancel
      </button>
    </span>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? confirmButtons : idleButton}
      <ActionError error={state.error} />
    </div>
  );
}
