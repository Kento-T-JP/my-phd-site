import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
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
          role: 'player',
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

  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminCount === 0) {
    if (!adminEmail || !adminPassword) {
      console.log(
        '❌ ADMIN_EMAIL or ADMIN_PASSWORD environment variable is not set; admin user not created.'
      );
    } else {
      const hashedPassword = await hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          email: adminEmail,
          hashedPassword,
          isAdmin: true,
        },
      });
      console.log('✅ Seeded admin user');
    }
  } else {
    console.log('✅ Admin user already exists, skipping seed.');
  }

  if (adminEmail && adminPassword) {
    console.log(`🛈 Admin email: ${adminEmail}`);
    console.log(`🛈 Admin password: ${adminPassword}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
