/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
CREATE SEQUENCE player_id_seq;
ALTER TABLE "Player" ALTER COLUMN "id" SET DEFAULT nextval('player_id_seq');
ALTER SEQUENCE player_id_seq OWNED BY "Player"."id";

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");
