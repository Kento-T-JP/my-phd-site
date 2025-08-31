// ESM 接続専用
import { PrismaClient, type Prisma } from '@prisma/client';
import type { Player } from '@/types/player';

export function normalizeSlug(str: string) {
  return str
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const prisma = new PrismaClient();

export default prisma;

interface HasTransaction {
  $transaction: PrismaClient['$transaction'];
}

/**
 * Retrieve various statistics for the admin dashboard.
 */
export async function getAdminStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    verifiedUsers,
    totalFormations,
    totalContactInquiries,
    registrationsLast7Days,
    pageViews,
    uniqueVisitors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.formation.count(),
    prisma.contactSubmission.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.visit.count(),
    prisma.visit
      .findMany({ distinct: ['ip'], select: { ip: true } })
      .then((rows) => rows.length),
  ]);
  return {
    totalUsers,
    verifiedUsers,
    totalFormations,
    totalContactInquiries,
    registrationsLast7Days,
    pageViews,
    siteVisitors: uniqueVisitors,
  };
}

/**
 * すべての選手を id 昇順で取得するユーティリティ関数。
 * API ルート（/api/players）などから呼び出して使用します。
 */
export async function getPlayers(rosterId?: number, userId?: number | string) {
  // Safely normalize userId: accept string or number, ignore invalid
  const uid = typeof userId === 'string' ? Number(userId) : userId;
  const hasUid = typeof uid === 'number' && Number.isFinite(uid);

  const baseIds: number[] = [];
  if (hasUid) {
    const overrides = await prisma.player.findMany({
      where: { userId: uid, basePlayerId: { not: null } },
      select: { basePlayerId: true },
    });
    for (const o of overrides) {
      if (o.basePlayerId !== null) {
        baseIds.push(o.basePlayerId);
      }
    }
  }
  const playerWhere: Prisma.PlayerWhereInput = hasUid
    ? {
        isDeleted: false,
        OR: [{ userId: uid }, { userId: null }],
        id: baseIds.length ? { notIn: baseIds } : undefined,
      }
    : { isDeleted: false, userId: null };
  if (rosterId) {
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        players: {
          where: { player: playerWhere },
          include: { player: true },
          orderBy: { playerId: 'asc' },
        },
      },
    });
    return (
      roster?.players.map((rp) => ({
        ...rp.player,
        number: rp.number ?? rp.player.number,
        position: rp.position?.length ? rp.position : rp.player.position,
        role: 'player',
      })) ?? []
    );
  }
  const players = await prisma.player.findMany({
    where: playerWhere,
    orderBy: { id: 'asc' },
    include: {
      rosterPlayers: {
        include: {
          roster: { select: { tournamentId: true } },
        },
      },
    },
  });
  return players.map((p) => ({ ...p, role: 'player' }));
}

/**
 * 新しい選手レコードを追加します。
 * ID は Prisma によって自動的に採番されます。
 */
export async function createPlayer(
  data: Omit<Player, 'id'>,
  rosterId?: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const rawUid = data.userId as unknown;
  const uid = typeof rawUid === 'string' ? Number(rawUid) : rawUid;
  const userId =
    typeof uid === 'number' && Number.isFinite(uid) ? uid : undefined;
  const dup = await client.player.findFirst({
    where: { name: data.name, userId: userId ?? null },
  });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const { role, ...rest } = data;
  void role;
  const player = await client.player.create({
    data: { ...rest, userId },
  });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return { ...player, role: 'player' };
}

/**
 * 名前をキーに既存レコードを更新、なければ新規作成します。
 */
export async function upsertPlayer(
  data: Omit<Player, 'id'>,
  rosterId?: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const existing = await client.player.findFirst({ where: { name: data.name } });
  let player;
  if (existing) {
    const { role, ...rest } = data;
    void role;
    player = await client.player.update({ where: { id: existing.id }, data: rest });
  } else {
    const { role, ...rest } = data;
    void role;
    player = await client.player.create({ data: rest });
  }
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return { ...player, role: 'player' };
}

/**
 * Update an existing player by id.
 * Throws if another player already has the same name.
 */
export async function updatePlayer(
  id: number,
  data: Omit<Player, 'id'>,
  rosterId?: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const rawUid = data.userId as unknown;
  const uid = typeof rawUid === 'string' ? Number(rawUid) : rawUid;
  const userId =
    typeof uid === 'number' && Number.isFinite(uid) ? uid : undefined;
  const dup = await client.player.findFirst({
    where: {
      name: data.name,
      userId: userId ?? null,
      NOT: { id },
    },
  });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const { role, ...rest } = data;
  void role;
  const player = await client.player.update({
    where: { id },
    data: { ...rest, userId },
  });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return { ...player, role: 'player' };
}

/** Upsert a tournament by name. */
export async function upsertTournament(
  name: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const slug = normalizeSlug(name);
  return client.tournament.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  });
}

/** Upsert a tournament using an explicit slug. */
export async function upsertTournamentBySlug(
  slug: string,
  name: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  return client.tournament.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

/** Upsert a roster by (tournamentId, title). */
export async function upsertRoster(
  tournamentId: number,
  title: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  date?: Date,
  userId?: number,
) {
  const where = { tournamentId_title: { tournamentId, title } } as const;
  return client.roster.upsert({
    where,
    update: {},
    create: { tournamentId, title, date: date ?? new Date(), userId: userId ?? null },
  });
}

/** Ensure a tournament exists and return its latest roster, creating one if needed. */
export async function ensureTournamentRoster(
  name: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  rosterDate?: Date,
  userId?: number,
) {
  const tournament = await upsertTournament(name, client);
  let roster: Awaited<ReturnType<typeof client.roster.findFirst>> | null = null;

  if (rosterDate) {
    const yyyy = rosterDate.getFullYear();
    const mm = String(rosterDate.getMonth() + 1).padStart(2, '0');
    const dd = String(rosterDate.getDate()).padStart(2, '0');
    const title = `${tournament.name} - ${yyyy}/${mm}/${dd}`;
    roster = await client.roster.findFirst({
      where: {
        tournamentId: tournament.id,
        OR: [{ date: rosterDate }, { title }],
      },
    });
    if (!roster) {
      roster = await upsertRoster(tournament.id, title, client, rosterDate, userId);
    }
  } else {
    roster = await client.roster.findFirst({
      where: { tournamentId: tournament.id },
      orderBy: { date: 'desc' },
    });
    if (!roster) {
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const title = `${tournament.name} - ${yyyy}/${mm}/${dd}`;
      roster = await upsertRoster(tournament.id, title, client, date, userId);
    }
  }
  return roster;
}

/** Link players to a roster, skipping duplicates. */
export async function addRosterPlayers(
  rosterId: number,
  players: { playerId: number; number?: number; position?: string[] }[],
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  if (players.length === 0) return;
  const upserts = players.map((p) =>
    client.rosterPlayer.upsert({
      where: { rosterId_playerId: { rosterId, playerId: p.playerId } },
      update: {},
      create: {
        rosterId,
        playerId: p.playerId,
        number: p.number,
        position: p.position,
      },
    })
  );
  if ('$transaction' in client) {
    const txClient = client as HasTransaction;
    await txClient.$transaction(upserts);
  } else {
    await Promise.all(upserts);
  }
}

/**
 * Toggle a player's association with a roster. If a record already exists,
 * it will be removed; otherwise it will be created.
 */
export async function syncRosterPlayers(
  playerId: number,
  rosterId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const where = { rosterId_playerId: { rosterId, playerId } } as const;
  const existing = await client.rosterPlayer.findUnique({ where });
  if (existing) {
    await client.rosterPlayer.delete({ where });
  } else {
    await client.rosterPlayer.create({ data: { rosterId, playerId } });
  }
}

/**
 * Upsert tournament and roster then link players, all within a transaction.
 */
export async function upsertTournamentRosterPlayers(
  tournament: string,
  rosterTitle: string,
  players: { playerId: number; number?: number; position?: string[] }[],
  client: Prisma.TransactionClient | PrismaClient = prisma,
  date?: Date,
) {
  const t = await upsertTournament(tournament, client);
  const r = await upsertRoster(t.id, rosterTitle, client, date);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Upsert by slug then link players. */
export async function upsertTournamentRosterPlayersBySlug(
  slug: string,
  tournament: string,
  rosterTitle: string,
  players: { playerId: number; number?: number; position?: string[] }[],
  date?: Date,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const t = await upsertTournamentBySlug(slug, tournament, client);
  const r = await upsertRoster(t.id, rosterTitle, client, date);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Get all rosters ordered by date. */
export async function getRosters(slug?: string, userId?: number) {
  const uid =
    typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
  const where: Prisma.RosterWhereInput = {
    ...(slug ? { tournament: { slug } } : {}),
    ...(uid !== undefined
      ? { OR: [{ userId: uid }, { userId: null }] }
      : { userId: null }),
  };
  return prisma.roster.findMany({
    where,
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
}

/** Get all tournaments. */
export async function getTournaments(userId?: number) {
  const uid =
    typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
  const where: Prisma.TournamentWhereInput =
    uid !== undefined
      ? { rosters: { some: { OR: [{ userId: uid }, { userId: null }] } } }
      : { rosters: { some: { userId: null } } };
  return prisma.tournament.findMany({
    where,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

/** Get tournament names for typeahead. */
export async function getTournamentNames(search?: string) {
  return prisma.tournament.findMany({
    where: search ? { name: { contains: search } } : undefined,
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/** Get roster titles for typeahead. */
export async function getRosterTitles(search?: string) {
  return prisma.roster.findMany({
    where: search ? { title: { contains: search } } : undefined,
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });
}

/** Get all favorite players for a user. */
export async function getFavoritePlayers(userId: number) {
  const favs = await prisma.favoritePlayer.findMany({
    where: { userId },
    include: { player: true },
    orderBy: { playerId: 'asc' },
  });
  return favs.map((f) => ({ ...f.player, role: 'player' }));
}

/** Add a player to the user's favorites. */
export async function addFavoritePlayer(userId: number, playerId: number) {
  await prisma.favoritePlayer.upsert({
    where: { userId_playerId: { userId, playerId } },
    update: {},
    create: { userId, playerId },
  });
}

/** Remove a player from the user's favorites. */
export async function removeFavoritePlayer(userId: number, playerId: number) {
  await prisma.favoritePlayer.delete({
    where: { userId_playerId: { userId, playerId } },
  });
}
