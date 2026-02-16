-- CreateIndex
CREATE INDEX "Player_userId_isDeleted_id_idx" ON "Player"("userId", "isDeleted", "id");

-- CreateIndex
CREATE INDEX "Tournament_userId_name_idx" ON "Tournament"("userId", "name");

-- CreateIndex
CREATE INDEX "Roster_userId_date_idx" ON "Roster"("userId", "date");

-- CreateIndex
CREATE INDEX "Roster_tournamentId_userId_idx" ON "Roster"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "RosterPlayer_playerId_idx" ON "RosterPlayer"("playerId");

-- CreateIndex
CREATE INDEX "RosterPlayer_rosterId_idx" ON "RosterPlayer"("rosterId");

-- CreateIndex
CREATE INDEX "Formation_userId_updatedAt_idx" ON "Formation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");

-- CreateIndex
CREATE INDEX "Visit_ip_idx" ON "Visit"("ip");
