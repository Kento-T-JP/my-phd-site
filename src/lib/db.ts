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

function normalizeTournamentName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeRosterTitle(title: string) {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

const prisma = new PrismaClient();

export default prisma;

/**
 * Retrieve various statistics for the admin dashboard.
 */
export async function getAdminStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const uniqueVisitorsPromise = prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT DISTINCT ip
      FROM "Visit"
      WHERE ip IS NOT NULL
    ) AS distinct_ips
  `;
  const [
    totalUsers,
    verifiedUsers,
    totalFormations,
    totalContactInquiries,
    registrationsLast7Days,
    pageViews,
    uniqueVisitorRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.formation.count(),
    prisma.contactSubmission.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.visit.count(),
    uniqueVisitorsPromise,
  ]);
  const uniqueVisitors = Number(uniqueVisitorRows[0]?.count ?? 0);
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
export async function getPlayers(
  rosterId?: number,
  userId?: number | string,
  opts?: { includeImage?: boolean; includeExtra?: boolean; includeRosterLinks?: boolean },
) {
  const includeImage = opts?.includeImage ?? true;
  const includeExtra = opts?.includeExtra ?? true;
  const includeRosterLinks = opts?.includeRosterLinks ?? false;
  const uid = typeof userId === 'string' ? Number(userId) : userId;
  const hasUid = typeof uid === 'number' && Number.isFinite(uid);
  if (!hasUid) {
    return [];
  }

  const playerWhere: Prisma.PlayerWhereInput = {
    isDeleted: false,
    userId: uid,
  };
  if (rosterId) {
    const roster = await prisma.roster.findFirst({
      where: { id: rosterId, userId: uid },
      include: {
        players: {
          where: { player: playerWhere },
          include: {
            player: {
              select: {
                id: true,
                name: true,
                position: true,
                number: true,
                image: includeImage,
                wikiUrl: true,
                userId: true,
                basePlayerId: true,
                isDeleted: true,
                extra: includeExtra,
              },
            },
          },
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
    select: {
      id: true,
      name: true,
      position: true,
      number: true,
      image: includeImage,
      wikiUrl: true,
      userId: true,
      basePlayerId: true,
      isDeleted: true,
      extra: includeExtra,
      ...(includeRosterLinks
        ? {
            rosterPlayers: {
              include: {
                roster: { select: { tournamentId: true } },
              },
            },
          }
        : {}),
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
  if (dup && !dup.isDeleted) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const { role, extra, rosterPlayers, ...rest } = data;
  void role;
  void rosterPlayers;
  const playerData: Prisma.PlayerUncheckedCreateInput = {
    name: rest.name,
    position: rest.position,
    number: rest.number,
    image: rest.image,
    wikiUrl: rest.wikiUrl,
    basePlayerId: rest.basePlayerId,
    isDeleted: rest.isDeleted,
    deletedAt: rest.isDeleted ? new Date() : null,
    userId,
    extra: extra as Prisma.InputJsonValue | undefined,
  };
  const player = dup
    ? await client.player.update({
        where: { id: dup.id },
        data: {
          ...playerData,
          isDeleted: false,
          deletedAt: null,
        },
      })
    : await client.player.create({
        data: playerData,
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
  userId?: number | string,
) {
  const rawUid = userId ?? (data.userId as unknown);
  const uid = typeof rawUid === 'string' ? Number(rawUid) : rawUid;
  const uidNum =
    typeof uid === 'number' && Number.isFinite(uid) ? uid : undefined;
  const existing = await client.player.findFirst({
    where: { name: data.name, userId: uidNum ?? null },
  });
  let player;
  const { role, extra, rosterPlayers, ...rest } = data;
  void role;
  void rosterPlayers;
  const playerData: Prisma.PlayerUncheckedCreateInput = {
    name: rest.name,
    position: rest.position,
    number: rest.number,
    image: rest.image,
    wikiUrl: rest.wikiUrl,
    basePlayerId: rest.basePlayerId,
    isDeleted: rest.isDeleted,
    deletedAt: rest.isDeleted ? new Date() : null,
    userId: uidNum,
    extra: extra as Prisma.InputJsonValue | undefined,
  };
  if (existing) {
    player = await client.player.update({
      where: { id: existing.id },
      data: {
        ...playerData,
        // Upsert should revive soft-deleted records by default.
        isDeleted: playerData.isDeleted ?? false,
        deletedAt: playerData.isDeleted ? playerData.deletedAt : null,
      },
    });
  } else {
    player = await client.player.create({
      data: playerData,
    });
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
  const { role, extra, rosterPlayers, ...rest } = data;
  void role;
  void rosterPlayers;
  const playerData: Prisma.PlayerUncheckedUpdateInput = {
    name: rest.name,
    position: rest.position,
    number: rest.number,
    image: rest.image,
    wikiUrl: rest.wikiUrl,
    basePlayerId: rest.basePlayerId,
    isDeleted: rest.isDeleted,
    userId,
    extra: extra as Prisma.InputJsonValue | undefined,
  };
  const player = await client.player.update({
    where: { id },
    data: playerData,
  });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return { ...player, role: 'player' };
}

/** Upsert a tournament by name. */
export async function upsertTournament(
  name: string,
  userId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  if (!Number.isFinite(userId)) {
    throw new Error('Valid userId is required');
  }
  const normalizedName = normalizeTournamentName(name);
  if (!normalizedName) {
    throw new Error('Tournament name is required');
  }
  const existingByName = await client.tournament.findFirst({
    where: {
      userId,
      name: { equals: normalizedName, mode: 'insensitive' },
    },
  });
  if (existingByName) {
    return existingByName;
  }
  const slug = normalizeSlug(normalizedName);
  return client.tournament.upsert({
    where: { userId_slug: { userId, slug } },
    update: { name: normalizedName },
    create: { name: normalizedName, slug, userId },
  });
}

/** Upsert a tournament using an explicit slug. */
export async function upsertTournamentBySlug(
  slug: string,
  name: string,
  userId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  if (!Number.isFinite(userId)) {
    throw new Error('Valid userId is required');
  }
  const normalizedName = normalizeTournamentName(name);
  if (!normalizedName) {
    throw new Error('Tournament name is required');
  }
  const existingByName = await client.tournament.findFirst({
    where: {
      userId,
      name: { equals: normalizedName, mode: 'insensitive' },
    },
  });
  if (existingByName) {
    return existingByName;
  }
  return client.tournament.upsert({
    where: { userId_slug: { userId, slug } },
    update: { name: normalizedName },
    create: { name: normalizedName, slug, userId },
  });
}

/** Upsert a roster by (tournamentId, title). */
export async function upsertRoster(
  tournamentId: number,
  title: string,
  userId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  date?: Date,
) {
  if (!Number.isFinite(userId)) {
    throw new Error('Valid userId is required');
  }
  const normalizedTitle = normalizeRosterTitle(title);
  if (!normalizedTitle) {
    throw new Error('試合リスト名が空です');
  }
  const existingByName = await client.roster.findFirst({
    where: {
      tournamentId,
      title: { equals: normalizedTitle, mode: 'insensitive' },
    },
    select: { id: true, tournamentId: true },
  });
  if (existingByName && existingByName.tournamentId === tournamentId) {
    return client.roster.findUniqueOrThrow({ where: { id: existingByName.id } });
  }
  const where = { tournamentId_title: { tournamentId, title: normalizedTitle } } as const;
  return client.roster.upsert({
    where,
    update: {},
    create: { tournamentId, title: normalizedTitle, date: date ?? new Date(), userId },
  });
}

/** Ensure a tournament exists and return its latest roster, creating one if needed. */
export async function ensureTournamentRoster(
  name: string,
  userId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  rosterDate?: Date,
) {
  const tournament = await upsertTournament(name, userId, client);
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
      roster = await upsertRoster(tournament.id, title, userId, client, rosterDate);
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
      roster = await upsertRoster(tournament.id, title, userId, client, date);
    }
  }
  return roster;
}

/** Link players to a roster, skipping duplicates. */
export async function addRosterPlayers(
  rosterId: number | number[],
  players: { playerId: number; number?: number; position?: string[] }[],
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  if (players.length === 0) return 0;
  const rosterIds = Array.isArray(rosterId) ? rosterId : [rosterId];
  const uniqueRosterIds = Array.from(
    new Set(rosterIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
  if (uniqueRosterIds.length === 0) return 0;
  const data = uniqueRosterIds.flatMap((id) =>
    players.map((p) => ({
      rosterId: id,
      playerId: p.playerId,
      number: p.number,
      position: p.position,
    })),
  );

  // Prefer bulk insert to reduce query count on large imports.
  if (typeof (client as any).rosterPlayer?.createMany === 'function') {
    const result = await (client as any).rosterPlayer.createMany({
      data,
      skipDuplicates: true,
    });
    // Avoid extra queries inside interactive transactions to reduce timeout risk.
    if (typeof result?.count === 'number') {
      return result.count;
    }
    return players.length;
  }

  const upserts = data.map((p) =>
    client.rosterPlayer.upsert({
      where: { rosterId_playerId: { rosterId: p.rosterId, playerId: p.playerId } },
      update: {},
      create: p,
    })
  );
  await Promise.all(upserts);
  return data.length;
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
  userId: number,
  client: Prisma.TransactionClient | PrismaClient = prisma,
  date?: Date,
) {
  const t = await upsertTournament(tournament, userId, client);
  const r = await upsertRoster(t.id, rosterTitle, userId, client, date);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Upsert by slug then link players. */
export async function upsertTournamentRosterPlayersBySlug(
  slug: string,
  tournament: string,
  rosterTitle: string,
  players: { playerId: number; number?: number; position?: string[] }[],
  userId: number,
  date?: Date,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const t = await upsertTournamentBySlug(slug, tournament, userId, client);
  const r = await upsertRoster(t.id, rosterTitle, userId, client, date);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Get all rosters ordered by date. */
export async function getRosters(slug?: string, userId?: number) {
  const uid =
    typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
  if (uid === undefined) {
    return [];
  }
  const where: Prisma.RosterWhereInput = {
    userId: uid,
    ...(slug ? { tournament: { slug, userId: uid } } : {}),
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
  if (uid === undefined) {
    return [];
  }
  const where: Prisma.TournamentWhereInput = {
    userId: uid,
  };
  return prisma.tournament.findMany({
    where,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

/** Get tournament names for typeahead. */
export async function getTournamentNames(search?: string, userId?: number) {
  const uid =
    typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
  if (uid === undefined) {
    return [];
  }
  return prisma.tournament.findMany({
    where: {
      userId: uid,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      rosters: { some: { userId: uid } },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/** Get roster titles for typeahead. */
export async function getRosterTitles(search?: string, userId?: number) {
  const uid =
    typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
  if (uid === undefined) {
    return [];
  }
  return prisma.roster.findMany({
    where: {
      userId: uid,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });
}

/** Get all favorite players for a user. */
export async function getFavoritePlayers(userId: number) {
  const favs = await prisma.favoritePlayer.findMany({
    where: {
      userId,
      player: {
        isDeleted: false,
      },
    },
    include: { player: true },
    orderBy: { playerId: 'asc' },
  });
  return favs
    .map((f) => f.player)
    .filter((player) => !player.isDeleted)
    .map((player) => ({ ...player, role: 'player' }));
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
