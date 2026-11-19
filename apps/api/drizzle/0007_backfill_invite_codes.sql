-- Every player needs an invite code before the column can be required
-- (0008), and the players who signed in before friends existed have none.
--
-- The code is eight characters of the hexadecimal digits of a random UUID,
-- in upper case: they are a subset of the Crockford base32 alphabet the
-- application generates codes from, so a backfilled code is typed, read and
-- normalised exactly like any other.
--
-- Each code is drawn again until it is free. 16^8 codes make a repeat
-- unlikely, but the next migration makes the column unique, so a repeat
-- here would not be a wasted code: it would fail the migration and leave
-- the API unable to start. The application draws codes the same way, and
-- retries the same way (`user-repository.ts`).
DO $$
DECLARE
  player record;
  candidate text;
BEGIN
  FOR player IN SELECT "id" FROM "users" WHERE "invite_code" IS NULL LOOP
    LOOP
      candidate := upper(substr(md5(gen_random_uuid()::text), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "users" WHERE "invite_code" = candidate
      );
    END LOOP;
    UPDATE "users" SET "invite_code" = candidate WHERE "id" = player."id";
  END LOOP;
END $$;
