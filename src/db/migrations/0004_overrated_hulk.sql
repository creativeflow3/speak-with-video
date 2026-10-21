DROP INDEX "anki_list_active_per_user_idx";--> statement-breakpoint
ALTER TABLE "anki_list" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Hand-added backfill: each user's current active list becomes their Default list,
-- and any unnamed soft-deleted lists get a placeholder so the column can be NOT NULL.
UPDATE "anki_list" SET "anki_list_name" = 'Default', "is_default" = true WHERE "deleted" = false;--> statement-breakpoint
UPDATE "anki_list" SET "anki_list_name" = 'Archived' WHERE "deleted" = true AND "anki_list_name" IS NULL;--> statement-breakpoint
ALTER TABLE "anki_list" ALTER COLUMN "anki_list_name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "anki_list_default_per_user_idx" ON "anki_list" USING btree ("user_id") WHERE is_default = true AND deleted = false;--> statement-breakpoint
CREATE UNIQUE INDEX "anki_list_name_per_user_idx" ON "anki_list" USING btree ("user_id",lower("anki_list_name")) WHERE deleted = false;
