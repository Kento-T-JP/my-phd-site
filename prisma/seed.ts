import { PrismaClient } from '@prisma/client';
import { players }        from '../src/data/players';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.player.count();
  if (count === 0) {
    await prisma.player.createMany({
      data: players,
      skipDuplicates: true,
    });
    console.log(`✅ Seeded ${players.length} players`);
  } else {
    console.log(`✅ Players already exist, skipping seed.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());