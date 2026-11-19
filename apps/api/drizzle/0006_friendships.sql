CREATE TABLE "friendships" (
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp (3) with time zone NOT NULL,
	"responded_at" timestamp (3) with time zone,
	CONSTRAINT "friendships_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id"),
	CONSTRAINT "friendships_not_self" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id"),
	CONSTRAINT "friendships_status" CHECK ("friendships"."status" in ('pending', 'accepted'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friendships_addressee_idx" ON "friendships" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "friendships_requester_idx" ON "friendships" USING btree ("requester_id","status");