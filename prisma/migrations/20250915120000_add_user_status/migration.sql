-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

UPDATE "public"."User" SET "status" = 'active';
