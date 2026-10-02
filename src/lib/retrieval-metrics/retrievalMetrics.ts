/** 2 = great example, 1 = valid but weak, 0 = false hit. Unlabeled chunks count as 0. */
export type Grade = 0 | 1 | 2;

/** A hand-labeled occurrence of the query phrase in an ingested video. */
export interface LabeledOccurrence {
  videoId: string;
  /** A moment (seconds) inside the occurrence — a retrieved clip whose window covers it gets credit. */
  time: number;
  grade: Grade;
}

export interface RetrievedClip {
  videoId: string;
  startTime: number;
  endTime: number;
}

function covers(clip: RetrievedClip, label: LabeledOccurrence): boolean {
  return clip.videoId === label.videoId && clip.startTime <= label.time && label.time <= clip.endTime;
}

/**
 * Grade of each retrieved clip, in order. A clip earns the best grade among the
 * labels its time window covers. Each label is credited once, so two overlapping
 * chunks around the same occurrence don't both score.
 */
export function gradeClips(retrieved: RetrievedClip[], labels: LabeledOccurrence[]): Grade[] {
  const unused = new Set(labels);
  return retrieved.map((clip) => {
    const best = [...unused]
      .filter((label) => covers(clip, label))
      .reduce<LabeledOccurrence | undefined>((top, label) => (top && top.grade >= label.grade ? top : label), undefined);
    if (!best) return 0;
    unused.delete(best);
    return best.grade;
  });
}

function dcg(grades: number[]): number {
  return grades.reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0);
}

/** Normalized DCG over the top k: 1 means the best-graded clips came first. */
export function ndcgAtK(grades: Grade[], labels: LabeledOccurrence[], k: number): number {
  const ideal = dcg(labels.map((l) => l.grade).sort((a, b) => b - a).slice(0, k));
  return ideal === 0 ? 0 : dcg(grades.slice(0, k)) / ideal;
}

/** 1 if any of the top k is a valid example (grade ≥ 1), else 0. */
export function hitAtK(grades: Grade[], k: number): number {
  return grades.slice(0, k).some((g) => g >= 1) ? 1 : 0;
}

/** Reciprocal rank of the first valid example in the top k, or 0 if none. */
export function reciprocalRankAtK(grades: Grade[], k: number): number {
  const rank = grades.slice(0, k).findIndex((g) => g >= 1);
  return rank === -1 ? 0 : 1 / (rank + 1);
}

export function distinctVideos(items: { videoId: string }[]): number {
  return new Set(items.map((r) => r.videoId)).size;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
