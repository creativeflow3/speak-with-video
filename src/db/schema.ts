import { pgTable, text, integer, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

export const videoStatus = pgEnum("video_status", ["pending", "succeeded", "failed"]);

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: text("video_id").notNull().unique(),
  youtubeUrl: text("youtube_url").notNull(),
  language: text("language").notNull(),
  title: text("title"),
  channel: text("channel"),
  status: videoStatus("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  chunkCount: integer("chunk_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcriptApiUsage = pgTable("transcript_api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: text("video_id").notNull(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  succeeded: boolean("succeeded").notNull(),
});
