CREATE TYPE "public"."user_role" AS ENUM('Admin', 'User');--> statement-breakpoint
CREATE TYPE "public"."video_visibility" AS ENUM('base', 'private');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth0_sub" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'User' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth0_sub_unique" UNIQUE("auth0_sub")
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "visibility" "video_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- One-time backfill: videos ingested before per-user ownership existed become the shared base set.
UPDATE "videos" SET "visibility" = 'base';