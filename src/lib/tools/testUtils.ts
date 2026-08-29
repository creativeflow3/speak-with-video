import { vi } from "vitest";
import type { ToolContext } from "./context";

export function makeToolContext(onExport = vi.fn()): ToolContext {
  return { userId: "user-1", onExport };
}
