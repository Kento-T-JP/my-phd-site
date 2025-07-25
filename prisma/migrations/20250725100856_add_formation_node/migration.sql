-- CreateTable
CREATE TABLE "FormationNode" (
    "id" SERIAL NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "playerId" INTEGER NOT NULL,
    "formationId" INTEGER NOT NULL,

    CONSTRAINT "FormationNode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FormationNode" ADD CONSTRAINT "FormationNode_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationNode" ADD CONSTRAINT "FormationNode_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
