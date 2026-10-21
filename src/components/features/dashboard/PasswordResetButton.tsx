"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NETWORK_ERROR, errorMessageFor } from "../apiErrors";
import { ActionError } from "./ActionError";

type ResetState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

async function sendResetEmail(): Promise<ResetState> {
  try {
    const res = await fetch("/api/account/password-reset", { method: "POST" });
    if (res.ok) return { kind: "sent" };
    return { kind: "error", message: await errorMessageFor(res, { fallback: "We couldn't send the email. Try again." }) };
  } catch {
    return { kind: "error", message: NETWORK_ERROR };
  }
}

export function PasswordResetButton({ email }: { email: string }) {
  const [state, setState] = useState<ResetState>({ kind: "idle" });

  async function requestReset() {
    setState({ kind: "sending" });
    setState(await sendResetEmail());
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="text-sm text-ink">
        Check your inbox — we sent a link to <span className="font-medium">{email}</span>. It lets you
        set a new password.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={requestReset} disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Email me a reset link"}
      </Button>
      <ActionError error={state.kind === "error" ? state.message : null} />
    </div>
  );
}
