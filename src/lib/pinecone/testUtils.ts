import type { RagMatch } from "./pinecone";

export function makeRagMatch(overrides: Partial<RagMatch> = {}): RagMatch {
  const videoId = overrides.videoId ?? "abcdefghijk";
  return {
    videoId,
    text: "vale la pena",
    videoTitle: "Title",
    channel: "Channel",
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    startTime: 0,
    endTime: 5,
    score: 0.5,
    ...overrides,
  };
}
