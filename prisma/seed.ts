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
      const rosterEntries: { playerId: number; number?: number; position?: string[] }[] = [];
      for (const p of players) {
        const pl = await upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
        });
        rosterEntries.push({ playerId: pl.id, number: p.number ?? undefined, position: p.position });
        added++;
      }
      await addRosterPlayers(r.id, rosterEntries);
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