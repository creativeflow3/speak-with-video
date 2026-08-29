CREATE TABLE "anki_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"anki_list_name" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anki_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anki_list_id" uuid NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"notes" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anki_list" ADD CONSTRAINT "anki_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anki_list_items" ADD CONSTRAINT "anki_list_items_anki_list_id_anki_list_id_fk" FOREIGN KEY ("anki_list_id") REFERENCES "public"."anki_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anki_list_user_id_deleted_idx" ON "anki_list" USING btree ("user_id","deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "anki_list_active_per_user_idx" ON "anki_list" USING btree ("user_id") WHERE deleted = false;--> statement-breakpoint
CREATE INDEX "anki_list_items_anki_list_id_deleted_idx" ON "anki_list_items" USING btree ("anki_list_id","deleted");