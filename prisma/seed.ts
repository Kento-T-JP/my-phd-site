import { PrismaClient } from '@prisma/client';
import { scrapeJfaPlayers, validateJfaUrl } from '../src/lib/jfa';
import {
  upsertPlayer,
  upsertTournamentRosterPlayersBySlug,
} from '../src/lib/db';

const prisma = new PrismaClient();

const JFA_URL = process.env.JFA_MEMBER_URL || '';

async function main() {
  const count = await prisma.player.count();
  if (count === 0) {
    if (validateJfaUrl(JFA_URL)) {
      const {
        players,
        tournamentName,
        tournamentSlug,
        rosterTitle,
        rosterDate,
      } = await scrapeJfaPlayers(JFA_URL);
      const promises = players.map((p) =>
        upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
        })
      );
      const inserted = await Promise.all(promises);
      const rosterEntries = inserted.map((pl, idx) => ({
        playerId: pl.id,
        number: players[idx].number ?? undefined,
        position: players[idx].position,
      }));
      await upsertTournamentRosterPlayersBySlug(
        tournamentSlug,
        tournamentName,
        rosterTitle,
        rosterEntries,
        rosterDate,
      );
      console.log(`✅ Seeded ${inserted.length} players from JFA`);
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