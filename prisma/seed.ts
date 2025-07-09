import { PrismaClient } from '@prisma/client';
import { players }        from '../src/data/players';

const prisma = new PrismaClient();

async function main() {
  await prisma.player.deleteMany();           // 全削除
  await prisma.player.createMany({            // 一括挿入
    data: players,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${players.length} players`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());