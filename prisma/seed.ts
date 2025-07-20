import { PrismaClient } from '@prisma/client';
import { scrapeJfaPlayers, validateJfaUrl } from '../src/lib/jfa';
import {
  upsertPlayer,
  upsertTournament,
  upsertRoster,
  addRosterPlayers,
} from '../src/lib/db';

const prisma = new PrismaClient();

const JFA_URL = process.env.JFA_MEMBER_URL || '';

async function main() {
  const count = await prisma.player.count();
  if (count === 0) {
    if (validateJfaUrl(JFA_URL)) {
      const { players, tournament, rosterDate } = await scrapeJfaPlayers(JFA_URL);
      const t = await upsertTournament(tournament);
      const r = await upsertRoster(t.id, rosterDate ?? new Date());
      let added = 0;
      const ids: number[] = [];
      for (const p of players) {
        const pl = await upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
        });
        ids.push(pl.id);
        added++;
      }
      await addRosterPlayers(r.id, ids);
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