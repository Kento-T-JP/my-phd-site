-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT[],
    "number" INTEGER,
    "image" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);
