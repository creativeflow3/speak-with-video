import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, transcriptApiUsage, type VideoVisibility } from "@/db/schema";
import type { PageParams } from "@/lib/pagination";

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

const OWNED_VIDEO_COLUMNS = {
  id: videos.id,
  title: videos.title,
  channel: videos.channel,
  language: videos.language,
  status: videos.status,
  failureReason: videos.failureReason,
  chunkCount: videos.chunkCount,
  visibility: videos.visibility,
  youtubeUrl: videos.youtubeUrl,
  createdAt: videos.createdAt,
};

export type OwnedVideo = Pick<Video, keyof typeof OWNED_VIDEO_COLUMNS>;

export interface OwnedVideosPage {
  videos: OwnedVideo[];
  total: number;
}

/**
 * One page of the videos this user ingested first, newest first, plus how many they own in all.
 * Only the columns the dashboard shows, to keep egress low; `id` breaks ties so pages never overlap.
 */
export async function listOwnedVideosPage(ownerId: string, { page, limit }: PageParams): Promise<OwnedVideosPage> {
  const owned = eq(videos.ownerId, ownerId);
  const [rows, total] = await Promise.all([
    db
      .select(OWNED_VIDEO_COLUMNS)
      .from(videos)
      .where(owned)
      .orderBy(desc(videos.createdAt), desc(videos.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.$count(videos, owned),
  ]);
  return { videos: rows, total };
}

export async function recordTranscriptApiUsage(videoId: string, succeeded: boolean): Promise<void> {
  await db.insert(transcriptApiUsage).values({ videoId, succeeded });
}
