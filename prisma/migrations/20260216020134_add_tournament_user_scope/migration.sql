-- Scope Tournament ownership to a user and align related constraints.

ALTER TABLE "Tournament"
ADD COLUMN "userId" INTEGER;

-- Backfill from related rosters first.
UPDATE "Tournament" t
SET "userId" = r."userId"
FROM "Roster" r
WHERE r."tournamentId" = t."id"
  AND r."userId" IS NOT NULL
  AND t."userId" IS NULL;

-- Fallback for legacy rows: assign to the oldest user.
UPDATE "Tournament"
SET "userId" = (
  SELECT u."id"
  FROM "User" u
  ORDER BY u."id" ASC
  LIMIT 1
)
WHERE "userId" IS NULL;

ALTER TABLE "Tournament"
ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Tournament"
ADD CONSTRAINT "Tournament_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Tournament_slug_key";
CREATE UNIQUE INDEX "Tournament_userId_slug_key" ON "Tournament"("userId", "slug");

-- Ensure roster ownership is required and cascades properly.
UPDATE "Roster" r
SET "userId" = t."userId"
FROM "Tournament" t
WHERE r."userId" IS NULL
  AND r."tournamentId" = t."id";

ALTER TABLE "Roster"
ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Roster" DROP CONSTRAINT IF EXISTS "Roster_userId_fkey";
ALTER TABLE "Roster"
ADD CONSTRAINT "Roster_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
