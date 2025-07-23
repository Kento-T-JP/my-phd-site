-- Add per-roster number and position fields
ALTER TABLE "RosterPlayer" ADD COLUMN "number" INTEGER;
ALTER TABLE "RosterPlayer" ADD COLUMN "position" TEXT[];
