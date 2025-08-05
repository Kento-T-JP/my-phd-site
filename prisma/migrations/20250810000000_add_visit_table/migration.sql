-- CreateTable
CREATE TABLE "Visit" (
  "id" SERIAL PRIMARY KEY,
  "path" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
