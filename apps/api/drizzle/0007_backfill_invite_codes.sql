-- Every player needs an invite code before the column can be required
-- (0008), and the players who signed in before friends existed have none.
--
-- The code is eight characters of the hexadecimal digits of a random UUID,
-- in upper case: they are a subset of the Crockford base32 alphabet the
-- application generates codes from, so a backfilled code is typed, read and
-- normalised exactly like any other. Collisions are checked by the unique
-- index the next migration adds; with 16^8 codes and the handful of rows
-- this runs over, a repeat would be a lottery win.
UPDATE "users"
SET "invite_code" = upper(substr(md5(gen_random_uuid()::text), 1, 8))
WHERE "invite_code" IS NULL;
