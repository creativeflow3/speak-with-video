import type { ReactNode } from "react";
import { EYEBROW, MONO_LABEL } from "@/components/ui/styles";
import { AppNavLinks, LogoutLink, MobileNav } from "./AppNav";

interface AppShellProps {
  displayName: string;
  children: ReactNode;
}

/** The signed-in frame shared by Find a Phrase and the account pages: nav rail on the left, page on the right. */
export function AppShell({ displayName, children }: AppShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-12 lg:px-6 lg:py-10">
      <MobileNav />

      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-10 flex flex-col gap-8">
          <div>
            <p className={EYEBROW}>Real phrases, real videos</p>
            <p className="mt-2 font-display text-3xl italic text-ink">Speak With Video</p>
          </div>
          <AppNavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className={`hidden items-center justify-end gap-2 md:flex ${MONO_LABEL}`}>
          <span className="text-ink">Welcome, {displayName}</span>
          <span aria-hidden className="text-line">
            ·
          </span>
          <LogoutLink />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
