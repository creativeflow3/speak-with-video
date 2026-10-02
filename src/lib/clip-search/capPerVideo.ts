/**
 * Picks the top `k` items from a ranked list while allowing at most
 * `maxPerVideo` from any one video, so a video with many matching chunks can't
 * crowd out the rest. If there aren't enough distinct videos to fill `k`, the
 * skipped items backfill the remaining slots. The result keeps the input's
 * rank order.
 */
export function capPerVideo<T extends { videoId: string }>(ranked: T[], maxPerVideo: number, k: number): T[] {
  const picked = new Set<number>();
  const perVideo = new Map<string, number>();

  ranked.forEach((item, i) => {
    const count = perVideo.get(item.videoId) ?? 0;
    if (picked.size < k && count < maxPerVideo) {
      picked.add(i);
      perVideo.set(item.videoId, count + 1);
    }
  });

  for (let i = 0; i < ranked.length && picked.size < k; i++) picked.add(i);

  return ranked.filter((_, i) => picked.has(i));
}
