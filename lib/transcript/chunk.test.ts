import { describe, it, expect } from "vitest";
import { chunkTranscript, type TranscriptSegment } from "./chunk";

function segment(text: string, start: number, duration: number): TranscriptSegment {
  return { text, start, duration };
}

describe("chunkTranscript", () => {
  it("returns an empty array for an empty transcript", () => {
    expect(chunkTranscript([])).toEqual([]);
  });

  it("returns a single chunk for a single segment", () => {
    const segments = [segment("hola qué tal", 0, 2)];
    const chunks = chunkTranscript(segments, { targetWords: 50 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      text: "hola qué tal",
      startTime: 0,
      endTime: 2,
      chunkIndex: 0,
    });
  });

  it("keeps a transcript shorter than the target word count as one chunk", () => {
    const segments = [
      segment("uno dos tres", 0, 1),
      segment("cuatro cinco seis", 1, 1),
    ];
    const chunks = chunkTranscript(segments, { targetWords: 50 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("uno dos tres cuatro cinco seis");
    expect(chunks[0].startTime).toBe(0);
    expect(chunks[0].endTime).toBe(2);
  });

  it("splits into multiple chunks once the target word count is reached", () => {
    // 4 segments of 3 words each; target of 6 words should close the first
    // chunk after the second segment.
    const segments = [
      segment("uno dos tres", 0, 1),
      segment("cuatro cinco seis", 1, 1),
      segment("siete ocho nueve", 2, 1),
      segment("diez once doce", 3, 1),
    ];
    const chunks = chunkTranscript(segments, { targetWords: 6 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toBe("uno dos tres cuatro cinco seis");
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it("overlaps consecutive chunks by carrying the last segment forward", () => {
    const segments = [
      segment("uno dos tres", 0, 1),
      segment("cuatro cinco seis", 1, 1),
      segment("siete ocho nueve", 2, 1),
      segment("diez once doce", 3, 1),
    ];
    const chunks = chunkTranscript(segments, { targetWords: 6 });

    // The segment that closed chunk 0 ("cuatro cinco seis") should also open chunk 1.
    expect(chunks[0].text.endsWith("cuatro cinco seis")).toBe(true);
    expect(chunks[1].text.startsWith("cuatro cinco seis")).toBe(true);
  });

  it("computes startTime/endTime from the first and last segment in the chunk", () => {
    const segments = [
      segment("a b c", 10, 2), // 10 -> 12
      segment("d e f", 12, 3), // 12 -> 15
    ];
    const chunks = chunkTranscript(segments, { targetWords: 50 });

    expect(chunks[0].startTime).toBe(10);
    expect(chunks[0].endTime).toBe(15);
  });

  it("does not produce a trailing chunk containing only the overlap segment", () => {
    // Boundary hits exactly at the second-to-last segment.
    const segments = [
      segment("uno dos tres", 0, 1),
      segment("cuatro cinco seis", 1, 1),
      segment("siete", 2, 1),
    ];
    const chunks = chunkTranscript(segments, { targetWords: 6 });

    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.text).not.toBe("cuatro cinco seis");
    expect(lastChunk.text).toContain("siete");
  });
});
