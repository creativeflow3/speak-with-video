import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Right-aligned controls, e.g. a download button. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-4xl italic text-ink">{title}</h1>
          {description && <p className="mt-2 max-w-prose text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="tick-rail w-full" />
    </header>
  );
}
