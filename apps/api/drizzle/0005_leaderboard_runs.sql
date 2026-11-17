CREATE TABLE "leaderboard_runs" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"board" text NOT NULL,
	"score" integer NOT NULL,
	"time_ms" integer NOT NULL,
	"rank_key" integer NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"personal_record" boolean NOT NULL,
	CONSTRAINT "leaderboard_runs_score_non_negative" CHECK ("leaderboard_runs"."score" >= 0),
	CONSTRAINT "leaderboard_runs_time_non_negative" CHECK ("leaderboard_runs"."time_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "leaderboard_runs" ADD CONSTRAINT "leaderboard_runs_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_runs" ADD CONSTRAINT "leaderboard_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leaderboard_runs_best_idx" ON "leaderboard_runs" USING btree ("board","user_id","rank_key","time_ms","recorded_at","session_id");--> statement-breakpoint
CREATE INDEX "leaderboard_runs_user_idx" ON "leaderboard_runs" USING btree ("user_id");