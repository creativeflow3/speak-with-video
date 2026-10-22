"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOCUS_RING, MONO_LABEL, TEXT_LINK } from "@/components/ui/styles";

const APP_NAV = [
  { href: "/", label: "Find a Phrase" },
  { href: "/dashboard/lists", label: "Lists" },
  { href: "/dashboard/videos", label: "Videos" },
  { href: "/dashboard/account", label: "Account" },
] as const;

/** Home only matches itself; every other section also owns its sub-pages. */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppNavLinksProps {
  /** Called after a link is followed — the mobile drawer uses it to close. */
  onNavigate?: () => void;
}

/**
 * The app's links on a vertical scrubber rail: each link is a frame on the
 * timeline, and the current page carries the amber playhead.
 */
export function AppNavLinks({ onNavigate }: AppNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="tick-rail-vertical flex flex-col">
        {APP_NAV.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="relative">
              {active && <span aria-hidden className="absolute -left-px top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-sm bg-accent" />}
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`block rounded py-2.5 pl-5 font-display text-xl italic transition-colors ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                } ${FOCUS_RING}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A plain <a>, not <Link>: logout is an Auth0 route handler, not a page to prefetch. */
export function LogoutLink() {
  return (
    <a href="/auth/logout" className={`${MONO_LABEL} ${TEXT_LINK}`}>
      Log out
    </a>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
    </svg>
  );
}

/** Locks page scroll and listens for Escape while the drawer is open. */
function useDrawerEffects(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
}

/** Below `md`: a top bar with a hamburger that opens the same links in a slide-in drawer. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A route change (including browser back) closes the drawer — adjusted during render, not in an effect.
  if (open && openedAt !== pathname) setOpen(false);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);
  useDrawerEffects(open, close);

  function toggle() {
    setOpenedAt(pathname);
    setOpen((prev) => !prev);
  }

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <p className="font-display text-2xl italic text-ink">Speak With Video</p>
        <div className="flex items-center gap-3">
          <LogoutLink />
          <button
            ref={toggleRef}
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="app-drawer"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`relative z-50 rounded-lg border border-line bg-surface p-2 text-ink ${FOCUS_RING}`}
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
      </div>

      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-0 z-40 bg-ink/30 motion-safe:transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        id="app-drawer"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] border-r border-line bg-canvas px-6 pt-20 motion-safe:transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AppNavLinks onNavigate={close} />
      </div>
    </div>
  );
}
