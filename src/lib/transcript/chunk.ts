import type { TranscriptSegment, TextChunk, ChunkOptions } from "./types";

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function finalizeChunk(
  segments: TranscriptSegment[],
  chunkIndex: number,
): TextChunk {
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    text: segments.map((s) => s.text).join(" "),
    startTime: first.start,
    endTime: last.start + last.duration,
    chunkIndex,
  };
}

/**
 * Groups consecutive transcript segments into word-count-targeted chunks,
 * carrying the last segment of each chunk forward as the start of the next
 * one so a phrase spanning a chunk boundary isn't lost.
 *
 * Assumes a space-delimited language (word-boundary splitting doesn't apply
 * to languages like Japanese/Korean/Chinese — see plan's chunking scope note).
 */
export function chunkTranscript(
  segments: TranscriptSegment[],
  opts: ChunkOptions = {},
): TextChunk[] {
  const targetWords = opts.targetWords ?? 50;
  if (segments.length === 0) return [];

  const chunks: TextChunk[] = [];
  let current: TranscriptSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    current.push(segments[i]);
    const words = current.reduce((sum, s) => sum + wordCount(s.text), 0);
    const isLastSegment = i === segments.length - 1;

    if (words >= targetWords || isLastSegment) {
      chunks.push(finalizeChunk(current, chunks.length));
      if (!isLastSegment) {
        // Overlap: the next chunk starts with this chunk's last segment.
        current = [current[current.length - 1]];
      } else {
        current = [];
      }
    }
  }

  return chunks;
}
