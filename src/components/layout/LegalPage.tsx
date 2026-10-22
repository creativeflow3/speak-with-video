import type { ReactNode } from "react";
import Link from "next/link";
import { EYEBROW, TEXT_LINK } from "@/components/ui/styles";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR_NAME,
} from "@/lib/legal";

export function ContactEmailLink() {
  return <a href={LEGAL_CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</a>;
}

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  sections: LegalSection[];
}

export function LegalPage({ title, sections }: LegalPageProps) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-6">
      <Link
        href="/"
        className={`font-mono text-xs uppercase tracking-widest text-muted ${TEXT_LINK}`}
      >
        ← Back to {LEGAL_OPERATOR_NAME}
      </Link>
      <h1 className="mt-6 font-display text-4xl italic text-ink sm:text-5xl">{title}</h1>
      <p className={`mt-2 ${EYEBROW}`}>
        Last updated {LEGAL_LAST_UPDATED}
      </p>
      <div className="tick-rail mt-6 w-full" />
      <article className="mt-8 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
            <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
              {section.body}
            </div>
          </section>
        ))}
      </article>
    </main>
  );
}
