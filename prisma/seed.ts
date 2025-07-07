import { PrismaClient } from '@prisma/client';
import { players } from '../src/data/players';

const prisma = new PrismaClient();

async function main() {
  // remove existing
  await prisma.player.deleteMany();
  await prisma.player.createMany({ data: players });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
