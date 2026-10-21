export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export const TEXT_LINK = `underline-offset-4 hover:text-ink hover:underline ${FOCUS_RING} rounded`;

/** The small uppercase mono label used for field labels, metadata lines and eyebrows. */
export const MONO_LABEL = "font-mono text-xs uppercase tracking-widest text-muted";

export const TEXT_INPUT = `rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink ${FOCUS_RING}`;
