CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"board" text NOT NULL,
	"seed" text NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"session_id" uuid,
	"outcome" text,
	"completion_ms" integer,
	"recorded_at" timestamp (3) with time zone,
	"personal_record" boolean,
	CONSTRAINT "challenges_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenges_user_idx" ON "challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "challenges_ranking_idx" ON "challenges" USING btree ("board","completion_ms","recorded_at","session_id") WHERE "challenges"."outcome" = 'ranked';