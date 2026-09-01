-- The app pivoted from a structured-journal to a ChatGPT-style voice chat.
-- Drop every structured-data table (sessions and its children, goals, tags,
-- insights, user_state) — they are no longer used — and create the chat model:
-- conversations + messages. users + rate_limits survive (auth + spend guards).

--> statement-breakpoint
DROP TABLE IF EXISTS "insights" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user_state" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "tag_links" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "tags" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "next_steps" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "decisions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "reflections" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "goals" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "sessions" CASCADE;

--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations" USING btree ("user_id","updated_at" DESC);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversation_id" bigint NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
