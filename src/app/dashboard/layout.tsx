import type { Metadata } from "next";
import { DashboardNavLinks, MobileNav } from "@/components/layout/DashboardNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · Speak With Video" },
};

// No auth check here: layouts don't re-render on navigation, so each page checks
// the session itself via getDashboardUser().
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-12 lg:px-6 lg:py-10">
      <MobileNav />

      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-10 flex flex-col gap-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Speak With Video</p>
            <p className="mt-2 font-display text-3xl italic text-ink">Dashboard</p>
          </div>
          <DashboardNavLinks />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
