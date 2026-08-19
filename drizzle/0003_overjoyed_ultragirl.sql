ALTER TABLE "user_state" DROP CONSTRAINT "user_state_last_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_last_session_id_sessions_id_fk" FOREIGN KEY ("last_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_session_id_idx" ON "decisions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "events_session_id_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
-- Backfill before the unique index: merge goals that share (user_id, lower(title)).
-- The pre-constraint resolveGoalId had a select-then-insert race that could create
-- duplicates; repoint their next_steps at the lowest-id survivor, then drop them.
UPDATE "next_steps" ns SET "goal_id" = dup.keep_id
FROM (
  SELECT min(g.id) AS keep_id, g.user_id, lower(g.title) AS lt
  FROM "goals" g
  GROUP BY g.user_id, lower(g.title)
  HAVING count(*) > 1
) dup
JOIN "goals" g ON g.user_id = dup.user_id AND lower(g.title) = dup.lt AND g.id <> dup.keep_id
WHERE ns.goal_id = g.id;--> statement-breakpoint
DELETE FROM "goals" g
USING (
  SELECT min(g.id) AS keep_id, g.user_id, lower(g.title) AS lt
  FROM "goals" g
  GROUP BY g.user_id, lower(g.title)
  HAVING count(*) > 1
) dup
WHERE g.user_id = dup.user_id AND lower(g.title) = dup.lt AND g.id <> dup.keep_id;--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_id_lower_title_uniq" ON "goals" USING btree ("user_id",lower("title"));--> statement-breakpoint
CREATE INDEX "next_steps_session_id_idx" ON "next_steps" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "reflections_session_id_idx" ON "reflections" USING btree ("session_id");
