import type { FormEventHandler, ReactNode } from "react";

interface PanelProps {
  as?: "div" | "form";
  className?: string;
  children: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}

const PANEL_CLASSES = "rounded-2xl border border-line bg-surface p-5";

export function Panel({ as = "div", className, children, onSubmit }: PanelProps) {
  const classes = `${PANEL_CLASSES} ${className ?? ""}`;

  if (as === "form") {
    return (
      <form onSubmit={onSubmit} className={classes}>
        {children}
      </form>
    );
  }

  return <div className={classes}>{children}</div>;
}
