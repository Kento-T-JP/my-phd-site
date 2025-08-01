-- CreateTable
CREATE TABLE "FavoritePlayer" (
    "userId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePlayer_userId_playerId_key" ON "FavoritePlayer"("userId", "playerId");

-- AddForeignKey
ALTER TABLE "FavoritePlayer" ADD CONSTRAINT "FavoritePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePlayer" ADD CONSTRAINT "FavoritePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
