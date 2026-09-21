-- Sessions recorded before sign-in existed (Phase 6) have no owner. The API
-- was never deployed, so they exist only in development databases; they are
-- removed so that quiz_sessions.user_id can become NOT NULL in the next
-- migration. Answers are removed with them (ON DELETE CASCADE).
DELETE FROM "quiz_sessions" WHERE "user_id" IS NULL;
