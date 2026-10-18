import { Fragment } from "react";
import Link from "next/link";
import { TEXT_LINK } from "@/components/ui/styles";
import { LEGAL_CONTACT_MAILTO, LEGAL_OPERATOR_NAME } from "@/lib/legal";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: LEGAL_CONTACT_MAILTO },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 font-mono text-xs text-muted lg:px-6">
      <span>
        © {new Date().getFullYear()} {LEGAL_OPERATOR_NAME}
      </span>
      {FOOTER_LINKS.map(({ label, href }) => (
        <Fragment key={href}>
          <span aria-hidden className="text-line">·</span>
          <Link href={href} className={TEXT_LINK}>
            {label}
          </Link>
        </Fragment>
      ))}
    </footer>
  );
}
