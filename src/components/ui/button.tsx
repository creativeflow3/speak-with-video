import type { ButtonHTMLAttributes } from "react";
import { FOCUS_RING } from "./styles";

type ButtonVariant = "accent" | "secondary" | "pill";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Selected state for variant="pill" (rendered as aria-pressed). */
  active?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent:
    "rounded-lg bg-accent px-4 py-2 text-sm font-mono font-semibold uppercase tracking-wide text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50",
  secondary:
    "rounded-full bg-secondary px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wide text-secondary-ink transition-opacity hover:opacity-90",
  pill: "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
};

const PILL_STATE_CLASSES = {
  active: "border-ink bg-ink text-canvas",
  inactive: "border-line bg-surface text-muted hover:border-ink hover:text-ink",
};

export function Button({ variant = "accent", active, className, ...props }: ButtonProps) {
  const pillState = variant === "pill" ? PILL_STATE_CLASSES[active ? "active" : "inactive"] : "";

  return (
    <button
      aria-pressed={variant === "pill" ? active : undefined}
      className={`${VARIANT_CLASSES[variant]} ${pillState} ${FOCUS_RING} ${className ?? ""}`}
      {...props}
    />
  );
}
