-- Drop the obsolete tournament column after data migration
ALTER TABLE "Player" DROP COLUMN "tournament";
