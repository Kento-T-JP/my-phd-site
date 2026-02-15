-- Add missing User.name column to match Prisma schema
ALTER TABLE "public"."User" ADD COLUMN "name" TEXT;
