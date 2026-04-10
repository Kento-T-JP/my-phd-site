-- CreateTable
CREATE TABLE "FormationCollaborator" (
    "formationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationCollaborator_pkey" PRIMARY KEY ("formationId","userId")
);

-- CreateTable
CREATE TABLE "FormationEditSession" (
    "formationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationEditSession_pkey" PRIMARY KEY ("formationId","userId")
);

-- CreateIndex
CREATE INDEX "FormationCollaborator_userId_createdAt_idx" ON "FormationCollaborator"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FormationEditSession_formationId_lastSeenAt_idx" ON "FormationEditSession"("formationId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "FormationEditSession_userId_lastSeenAt_idx" ON "FormationEditSession"("userId", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "FormationCollaborator" ADD CONSTRAINT "FormationCollaborator_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationCollaborator" ADD CONSTRAINT "FormationCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationEditSession" ADD CONSTRAINT "FormationEditSession_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationEditSession" ADD CONSTRAINT "FormationEditSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
