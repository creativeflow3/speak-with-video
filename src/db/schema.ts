import { pgTable, text, integer, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

export const videoStatus = pgEnum("video_status", ["pending", "succeeded", "failed"]);
export const userRole = pgEnum("user_role", ["Admin", "User"]);
export const videoVisibility = pgEnum("video_visibility", ["base", "private"]);

export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  auth0Sub: text("auth0_sub").notNull().unique(),
  email: text("email").notNull(),
  role: userRole("role").notNull().default("User"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  ownerId: uuid("owner_id").references(() => users.id),
  visibility: videoVisibility("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcriptApiUsage = pgTable("transcript_api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: text("video_id").notNull(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  succeeded: boolean("succeeded").notNull(),
});
