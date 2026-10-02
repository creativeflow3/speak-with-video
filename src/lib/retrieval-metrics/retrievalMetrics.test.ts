import { describe, it, expect } from "vitest";
import {
  gradeClips,
  ndcgAtK,
  hitAtK,
  reciprocalRankAtK,
  distinctVideos,
  mean,
  type LabeledOccurrence,
  type RetrievedClip,
} from "./retrievalMetrics";

function clip(videoId: string, startTime: number, endTime = startTime + 10): RetrievedClip {
  return { videoId, startTime, endTime };
}

describe("gradeClips", () => {
  const labels: LabeledOccurrence[] = [
    { videoId: "a", time: 15, grade: 1 },
    { videoId: "b", time: 42, grade: 2 },
  ];

  it("grades a clip by the label its time window covers", () => {
    expect(gradeClips([clip("b", 40), clip("a", 10)], labels)).toEqual([2, 1]);
  });

  it("gives 0 to clips that cover no label, or cover one in another video", () => {
    expect(gradeClips([clip("a", 100), clip("b", 10)], labels)).toEqual([0, 0]);
  });

  it("credits each label once when overlapping chunks both cover it", () => {
    expect(gradeClips([clip("b", 35), clip("b", 40)], labels)).toEqual([2, 0]);
  });

  it("takes the best grade when one clip covers several labels", () => {
    const twoInOne: LabeledOccurrence[] = [
      { videoId: "a", time: 11, grade: 1 },
      { videoId: "a", time: 12, grade: 2 },
    ];
    expect(gradeClips([clip("a", 10), clip("a", 10)], twoInOne)).toEqual([2, 1]);
  });
});

describe("ndcgAtK", () => {
  const labels: LabeledOccurrence[] = [
    { videoId: "a", time: 0, grade: 2 },
    { videoId: "b", time: 0, grade: 1 },
  ];

  it("is 1 for the ideal ordering", () => {
    expect(ndcgAtK([2, 1, 0], labels, 5)).toBeCloseTo(1);
  });

  it("is lower when the great example ranks below the weak one", () => {
    const swapped = ndcgAtK([1, 2], labels, 5);
    expect(swapped).toBeLessThan(1);
    expect(swapped).toBeGreaterThan(0);
  });

  it("is 0 when nothing relevant is retrieved or nothing is labeled relevant", () => {
    expect(ndcgAtK([0, 0], labels, 5)).toBe(0);
    expect(ndcgAtK([0], [], 5)).toBe(0);
  });

  it("only counts the top k", () => {
    expect(ndcgAtK([0, 2], labels, 1)).toBe(0);
  });
});

describe("hitAtK / reciprocalRankAtK", () => {
  it("finds the first valid example within k", () => {
    expect(hitAtK([0, 0, 1], 5)).toBe(1);
    expect(reciprocalRankAtK([0, 0, 1], 5)).toBeCloseTo(1 / 3);
  });

  it("ignores grade-0 clips and anything past k", () => {
    expect(hitAtK([0, 0, 2], 2)).toBe(0);
    expect(reciprocalRankAtK([0, 0, 2], 2)).toBe(0);
  });
});

describe("distinctVideos / mean", () => {
  it("counts unique videos", () => {
    expect(distinctVideos([clip("a", 0), clip("a", 20), clip("b", 0)])).toBe(2);
  });

  it("averages, treating an empty list as 0", () => {
    expect(mean([1, 0, 0.5])).toBeCloseTo(0.5);
    expect(mean([])).toBe(0);
  });
});
