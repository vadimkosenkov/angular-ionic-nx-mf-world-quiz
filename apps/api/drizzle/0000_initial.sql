CREATE TABLE "quiz_answers" (
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"country_code" text NOT NULL,
	"answer" jsonb NOT NULL,
	"correct" boolean NOT NULL,
	"judgement" text NOT NULL,
	"answered_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "quiz_answers_session_id_sequence_pk" PRIMARY KEY("session_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"mode" text NOT NULL,
	"scope" text NOT NULL,
	"config" jsonb NOT NULL,
	"seed" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"finished_at" timestamp (3) with time zone NOT NULL,
	"end_reason" text NOT NULL,
	"answered" integer NOT NULL,
	"correct" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"completed" boolean NOT NULL,
	"perfect" boolean NOT NULL,
	"request_hash" text NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_sessions_correct_le_answered" CHECK ("quiz_sessions"."correct" <= "quiz_sessions"."answered"),
	CONSTRAINT "quiz_sessions_duration_non_negative" CHECK ("quiz_sessions"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_sessions_user_recorded_idx" ON "quiz_sessions" USING btree ("user_id","recorded_at");