import { PrismaClient } from '@prisma/client';
import { scrapeJfaPlayers, validateJfaUrl } from '../src/lib/jfa';
import { upsertPlayer } from '../src/lib/db';

const prisma = new PrismaClient();

const JFA_URL = process.env.JFA_MEMBER_URL || '';

async function main() {
  const count = await prisma.player.count();
  if (count === 0) {
    if (validateJfaUrl(JFA_URL)) {
      const { players } = await scrapeJfaPlayers(JFA_URL);
      let added = 0;
      for (const p of players) {
        await upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
          tournament: p.tournament,
        });
        added++;
      }
      console.log(`✅ Seeded ${added} players from JFA`);
    } else {
      console.log('❌ Invalid or missing JFA_MEMBER_URL environment variable');
    }
  } else {
    console.log(`✅ Players already exist, skipping seed.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());