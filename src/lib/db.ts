import { PrismaClient } from '@prisma/client';
import type { Player } from '@/types/player';
import { players as defaultPlayers } from '@/data/players';

const prisma = new PrismaClient();

async function ensureSeed() {
  const count = await prisma.player.count();
  if (count === 0) {
    await prisma.player.createMany({ data: defaultPlayers });
  }
}

export async function getPlayers(): Promise<Player[]> {
  await ensureSeed();
  return prisma.player.findMany({ orderBy: { id: 'asc' } });
}

export default prisma;
