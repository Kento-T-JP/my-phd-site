import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';

const prisma = new PrismaClient();

const BENCH_EMAIL = 'bench-perf@example.local';
const BENCH_PREFIX = 'BENCH_PLAYER_';

const TARGET = {
  players: 12000,
  rosters: 160,
  links: 48000,
  visits: 120000,
};

function avg(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timed(label, iterations, fn) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return {
    label,
    iterations,
    avgMs: Number(avg(times).toFixed(2)),
    p95Ms: Number(percentile(times, 95).toFixed(2)),
    minMs: Number(Math.min(...times).toFixed(2)),
    maxMs: Number(Math.max(...times).toFixed(2)),
  };
}

async function ensureBenchData() {
  const user = await prisma.user.upsert({
    where: { email: BENCH_EMAIL },
    update: {},
    create: {
      email: BENCH_EMAIL,
      name: 'DB Perf Bench',
      hashedPassword: 'bench-placeholder',
      status: 'approved',
      isAdmin: false,
    },
    select: { id: true },
  });

  const userId = user.id;

  const [playerCount, rosterCount, linkCount, visitCount] = await Promise.all([
    prisma.player.count({ where: { userId, name: { startsWith: BENCH_PREFIX } } }),
    prisma.roster.count({ where: { userId } }),
    prisma.rosterPlayer.count({ where: { roster: { userId } } }),
    prisma.visit.count(),
  ]);

  if (playerCount < TARGET.players) {
    const start = playerCount + 1;
    const totalToCreate = TARGET.players - playerCount;
    const chunk = 1000;
    for (let offset = 0; offset < totalToCreate; offset += chunk) {
      const size = Math.min(chunk, totalToCreate - offset);
      const data = Array.from({ length: size }, (_, i) => {
        const n = start + offset + i;
        return {
          userId,
          name: `${BENCH_PREFIX}${n}`,
          position: n % 11 === 0 ? ['GK'] : n % 3 === 0 ? ['MF'] : ['DF'],
          number: (n % 99) + 1,
          isDeleted: n % 23 === 0,
        };
      });
      await prisma.player.createMany({ data, skipDuplicates: true });
    }
  }

  const tournaments = await prisma.tournament.findMany({ where: { userId }, select: { id: true, name: true, slug: true } });
  if (tournaments.length === 0) {
    await prisma.tournament.createMany({
      data: Array.from({ length: 16 }, (_, i) => ({
        userId,
        name: `Bench Tournament ${i + 1}`,
        slug: `bench-tournament-${i + 1}`,
      })),
      skipDuplicates: true,
    });
  }

  const tournamentList = await prisma.tournament.findMany({ where: { userId }, select: { id: true } });

  if (rosterCount < TARGET.rosters) {
    const toCreate = TARGET.rosters - rosterCount;
    const now = Date.now();
    const data = Array.from({ length: toCreate }, (_, i) => {
      const idx = rosterCount + i + 1;
      const tournament = tournamentList[idx % tournamentList.length];
      return {
        userId,
        tournamentId: tournament.id,
        title: `Bench Roster ${idx}`,
        date: new Date(now - idx * 86400000),
      };
    });
    await prisma.roster.createMany({ data, skipDuplicates: true });
  }

  const players = await prisma.player.findMany({
    where: { userId, name: { startsWith: BENCH_PREFIX } },
    select: { id: true, number: true, position: true },
    orderBy: { id: 'asc' },
    take: TARGET.players,
  });
  const rosters = await prisma.roster.findMany({ where: { userId }, select: { id: true }, orderBy: { id: 'asc' }, take: TARGET.rosters });

  if (linkCount < TARGET.links && players.length > 0 && rosters.length > 0) {
    const toCreate = TARGET.links - linkCount;
    const chunk = 2000;
    for (let offset = 0; offset < toCreate; offset += chunk) {
      const size = Math.min(chunk, toCreate - offset);
      const data = Array.from({ length: size }, (_, i) => {
        const idx = offset + i;
        const player = players[idx % players.length];
        const roster = rosters[(idx * 7) % rosters.length];
        return {
          rosterId: roster.id,
          playerId: player.id,
          number: player.number ?? undefined,
          position: player.position,
        };
      });
      await prisma.rosterPlayer.createMany({ data, skipDuplicates: true });
    }
  }

  if (visitCount < TARGET.visits) {
    const toCreate = TARGET.visits - visitCount;
    const chunk = 5000;
    for (let offset = 0; offset < toCreate; offset += chunk) {
      const size = Math.min(chunk, toCreate - offset);
      const data = Array.from({ length: size }, (_, i) => {
        const n = offset + i;
        const octet = n % 254;
        return {
          path: n % 2 === 0 ? '/home' : '/players',
          ip: `10.${(n % 200) + 1}.${(n % 120) + 1}.${octet === 0 ? 1 : octet}`,
          userAgent: 'bench-agent',
          createdAt: new Date(Date.now() - n * 1000),
        };
      });
      await prisma.visit.createMany({ data });
    }
  }

  return { userId };
}

async function runExplain(userId) {
  const explainPlayer = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT p.id, p.name, p.position, p.number
    FROM "Player" p
    WHERE p."userId" = ${userId} AND p."isDeleted" = false
    ORDER BY p.id ASC
  `);

  const explainRoster = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT r.id, r.date, r.title
    FROM "Roster" r
    WHERE r."userId" = ${userId}
    ORDER BY r.date ASC
  `);

  return {
    player: explainPlayer.map((r) => r['QUERY PLAN']),
    roster: explainRoster.map((r) => r['QUERY PLAN']),
  };
}

async function runBench() {
  const { userId } = await ensureBenchData();

  const oldUniqueVisitorsQuery = async () => {
    const rows = await prisma.visit.findMany({ distinct: ['ip'], select: { ip: true } });
    return rows.length;
  };

  const newUniqueVisitorsQuery = async () => {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT DISTINCT ip
        FROM "Visit"
        WHERE ip IS NOT NULL
      ) AS distinct_ips
    `;
    const count = Number(rows?.[0]?.count ?? 0);
    return count;
  };

  const results = [];
  results.push(
    await timed('players_list_query', 8, async () => {
      await prisma.player.findMany({
        where: { userId, isDeleted: false },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          number: true,
          rosterPlayers: {
            include: {
              roster: { select: { tournamentId: true } },
            },
          },
        },
      });
    })
  );

  results.push(
    await timed('rosters_list_query', 20, async () => {
      await prisma.roster.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          endDate: true,
          title: true,
          tournamentId: true,
          tournament: { select: { name: true } },
        },
      });
    })
  );

  results.push(await timed('admin_unique_visitors_old', 8, oldUniqueVisitorsQuery));
  results.push(await timed('admin_unique_visitors_new', 8, newUniqueVisitorsQuery));

  const explain = await runExplain(userId);

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    userId,
    results,
    explain,
  }, null, 2));
}

runBench()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
