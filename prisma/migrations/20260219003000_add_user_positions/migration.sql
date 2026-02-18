CREATE TABLE "UserPosition" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPosition_userId_normalizedName_key" ON "UserPosition"("userId", "normalizedName");
CREATE INDEX "UserPosition_userId_name_idx" ON "UserPosition"("userId", "name");

ALTER TABLE "UserPosition" ADD CONSTRAINT "UserPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
