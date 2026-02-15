-- Add missing User.image column to match Prisma schema
ALTER TABLE "public"."User" ADD COLUMN "image" TEXT;
