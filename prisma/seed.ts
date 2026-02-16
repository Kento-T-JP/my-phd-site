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
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  let seedOwnerId: number | undefined;

  if (!adminEmail || !adminPassword) {
    console.log(
      '❌ ADMIN_EMAIL or ADMIN_PASSWORD environment variable is not set; admin user not created.'
    );
  } else {
    const hashedPassword = await hash(adminPassword, 10);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        hashedPassword,
        isAdmin: true,
      },
      create: {
        email: adminEmail,
        hashedPassword,
        isAdmin: true,
      },
      select: { id: true, email: true },
    });
    seedOwnerId = admin.id;
    console.log('✅ Admin user ensured');
    console.log(`🛈 Admin email: ${admin.email}`);
    console.log(`🛈 Admin password: ${adminPassword}`);
  }

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
          userId: seedOwnerId,
        })
      );
      const inserted = await Promise.all(promises);
      const rosterEntries = inserted.map((pl, idx) => ({
        playerId: pl.id,
        number: players[idx].number ?? undefined,
        position: players[idx].position,
      }));
      if (typeof seedOwnerId === 'number' && Number.isFinite(seedOwnerId)) {
        await upsertTournamentRosterPlayersBySlug(
          tournamentSlug,
          tournamentName,
          rosterTitle,
          rosterEntries,
          seedOwnerId,
          rosterDate,
        );
      } else {
        console.log('⚠️ Seed owner not found, skipped tournament/roster seed.');
      }
      console.log(`✅ Seeded ${inserted.length} players from JFA`);
    } else {
      console.log('❌ Invalid or missing JFA_MEMBER_URL environment variable');
    }
  } else {
    console.log(`✅ Players already exist, skipping seed.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
