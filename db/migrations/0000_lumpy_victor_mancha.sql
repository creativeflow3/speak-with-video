CREATE TYPE "public"."video_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "transcript_api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"youtube_url" text NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"channel" text,
	"status" "video_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"chunk_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_video_id_unique" UNIQUE("video_id")
);
