import { vi } from "vitest";
import type { ToolContext } from "./context";

export function makeToolContext(onExport = vi.fn(), overrides: Partial<ToolContext> = {}): ToolContext {
  return { userId: "user-1", onExport, ...overrides };
}
