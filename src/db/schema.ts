import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, uuid, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

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

export const ankiList = pgTable(
  "anki_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ankiListName: text("anki_list_name"),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("anki_list_user_id_deleted_idx").on(table.userId, table.deleted),
    uniqueIndex("anki_list_active_per_user_idx").on(table.userId).where(sql`deleted = false`),
  ],
);

export const ankiListItems = pgTable(
  "anki_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ankiListId: uuid("anki_list_id")
      .notNull()
      .references(() => ankiList.id),
    front: text("front").notNull(),
    back: text("back").notNull(),
    notes: text("notes"),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("anki_list_items_anki_list_id_deleted_idx").on(table.ankiListId, table.deleted)],
);
