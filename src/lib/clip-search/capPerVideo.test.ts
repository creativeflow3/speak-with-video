import { describe, it, expect } from "vitest";
import { capPerVideo } from "./capPerVideo";

function items(videoIds: string[]) {
  return videoIds.map((videoId, rank) => ({ videoId, rank }));
}

describe("capPerVideo", () => {
  it("keeps a heavily-matching video from filling every slot", () => {
    // Video "a" has 15 matching chunks ranked above video "b"'s 2.
    const ranked = items([...Array(15).fill("a"), "b", "b"]);

    const result = capPerVideo(ranked, 2, 5);

    expect(result.map((r) => r.videoId)).toEqual(["a", "a", "a", "b", "b"]);
  });

  it("returns k results from a single-video library by backfilling", () => {
    const result = capPerVideo(items(["a", "a", "a", "a", "a", "a"]), 2, 5);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.rank)).toEqual([0, 1, 2, 3, 4]);
  });

  it("preserves rank order after backfilling", () => {
    // Cap picks a0, a1, b3, then backfills a2 — which must land before b3, not after.
    const result = capPerVideo(items(["a", "a", "a", "b"]), 2, 4);
    expect(result.map((r) => r.rank)).toEqual([0, 1, 2, 3]);
  });

  it("prefers a lower-ranked video over a capped one before backfilling", () => {
    const result = capPerVideo(items(["a", "a", "a", "b"]), 2, 3);
    expect(result.map((r) => r.rank)).toEqual([0, 1, 3]);
  });

  it("returns everything when there are fewer than k items", () => {
    expect(capPerVideo(items(["a", "b"]), 1, 5)).toHaveLength(2);
  });

  it("returns an empty list for empty input", () => {
    expect(capPerVideo([], 2, 5)).toEqual([]);
  });
});
