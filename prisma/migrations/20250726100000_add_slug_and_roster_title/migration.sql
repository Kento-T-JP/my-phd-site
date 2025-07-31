-- Add slug and roster title
ALTER TABLE "Tournament" ADD COLUMN "slug" TEXT;
UPDATE "Tournament" SET "slug" = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) WHERE "slug" IS NULL;
ALTER TABLE "Tournament" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

ALTER TABLE "Roster" ADD COLUMN "title" TEXT;
UPDATE "Roster" r
  SET "title" = t.name || ' (' || to_char(r.date, 'YYYY-MM-DD') || ')'
  FROM "Tournament" t
  WHERE r."tournamentId" = t.id AND r."title" IS NULL;
ALTER TABLE "Roster" ALTER COLUMN "title" SET NOT NULL;
DROP INDEX "Roster_tournamentId_date_key";
CREATE UNIQUE INDEX "Roster_tournamentId_title_key" ON "Roster"("tournamentId", "title");
