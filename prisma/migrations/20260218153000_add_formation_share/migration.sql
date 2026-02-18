-- CreateTable
CREATE TABLE "FormationShare" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "formationId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormationShare_token_key" ON "FormationShare"("token");

-- CreateIndex
CREATE INDEX "FormationShare_token_expiresAt_idx" ON "FormationShare"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "FormationShare_userId_createdAt_idx" ON "FormationShare"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FormationShare" ADD CONSTRAINT "FormationShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
