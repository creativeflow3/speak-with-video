import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDashboardUser } from "@/lib/authz";
import { hasDatabasePassword, loginMethodFor } from "@/lib/auth0-account";
import { Panel } from "@/components/ui/panel";
import { MONO_LABEL } from "@/components/ui/styles";
import { PageHeader } from "@/components/layout/PageHeader";
import { PasswordResetButton } from "@/components/features/dashboard/PasswordResetButton";

export const metadata: Metadata = { title: "Account" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className={`w-32 shrink-0 ${MONO_LABEL}`}>{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function PasswordSection({ auth0Sub, email }: { auth0Sub: string; email: string }) {
  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-display text-xl italic text-ink">Change password</h2>
      {hasDatabasePassword(auth0Sub) ? (
        <>
          <p className="text-sm text-muted">
            We&apos;ll email you a secure link to choose a new password. You stay signed in here until
            you log out.
          </p>
          <PasswordResetButton email={email} />
        </>
      ) : (
        <p className="text-sm text-muted">
          Your password is managed by {loginMethodFor(auth0Sub)}. Change it in your{" "}
          {loginMethodFor(auth0Sub)} account settings.
        </p>
      )}
    </Panel>
  );
}

export default async function AccountPage() {
  const user = await getDashboardUser("/dashboard/account");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" />
      <dl className="flex flex-col gap-4">
        <Field label="Email">{user.email || "—"}</Field>
        <Field label="Signs in with">{loginMethodFor(user.auth0Sub)}</Field>
      </dl>
      <PasswordSection auth0Sub={user.auth0Sub} email={user.email} />
    </div>
  );
}
