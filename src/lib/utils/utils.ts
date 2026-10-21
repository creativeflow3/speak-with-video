import { z } from "zod";
import type { SseFrame } from "@/types";

const uuidSchema = z.uuid();

/** Guards ids from URLs or request bodies — a malformed one would otherwise surface as a Postgres cast error. */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

/** "1 word", "3 words" — pass `plural` for irregular nouns. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseChunk(buffer: string): { frames: SseFrame[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const frames: SseFrame[] = [];

  for (const part of parts) {
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice("event: ".length);
      if (line.startsWith("data: ")) data = line.slice("data: ".length);
    }
    if (data) frames.push({ event, data });
  }

  return { frames, rest };
}
