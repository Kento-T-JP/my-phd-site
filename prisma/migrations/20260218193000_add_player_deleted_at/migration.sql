ALTER TABLE "Player"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Player_userId_isDeleted_deletedAt_idx"
ON "Player"("userId", "isDeleted", "deletedAt");
