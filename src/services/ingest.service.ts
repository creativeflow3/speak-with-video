import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, transcriptApiUsage, type VideoVisibility } from "@/db/schema";

export type Video = typeof videos.$inferSelect;

export interface CreateVideoInput {
  videoId: string;
  youtubeUrl: string;
  language: string;
  ownerId: string;
  visibility: VideoVisibility;
}

export interface MarkVideoSucceededInput {
  title: string | null;
  channel: string | null;
  chunkCount: number;
}

async function updateVideo(videoId: string, fields: Partial<typeof videos.$inferInsert>): Promise<void> {
  await db.update(videos).set(fields).where(eq(videos.videoId, videoId));
}

export async function findVideoByVideoId(videoId: string): Promise<Video | undefined> {
  const [video] = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
  return video;
}

export async function createVideo(input: CreateVideoInput): Promise<void> {
  await db.insert(videos).values({
    videoId: input.videoId,
    youtubeUrl: input.youtubeUrl,
    language: input.language,
    status: "pending",
    ownerId: input.ownerId,
    visibility: input.visibility,
  });
}

export async function markVideoPending(videoId: string, language: string): Promise<void> {
  await updateVideo(videoId, { status: "pending", language, failureReason: null });
}

export async function markVideoFailed(videoId: string, reason: string): Promise<void> {
  await updateVideo(videoId, { status: "failed", failureReason: reason });
}

export async function markVideoSucceeded(videoId: string, input: MarkVideoSucceededInput): Promise<void> {
  await updateVideo(videoId, {
    status: "succeeded",
    title: input.title,
    channel: input.channel,
    chunkCount: input.chunkCount,
    failureReason: null,
  });
}

export async function recordTranscriptApiUsage(videoId: string, succeeded: boolean): Promise<void> {
  await db.insert(transcriptApiUsage).values({ videoId, succeeded });
}
