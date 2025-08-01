// ESM 接続専用
import { PrismaClient, type Prisma } from '@prisma/client';
import type { Player } from '@/types/player';

export function normalizeSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const prisma = new PrismaClient();

export default prisma;

/**
 * すべての選手を id 昇順で取得するユーティリティ関数。
 * API ルート（/api/players）などから呼び出して使用します。
 */
export async function getPlayers(rosterId?: number) {
  if (rosterId) {
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        players: {
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
      })) ?? []
    );
  }
  return prisma.player.findMany({
    orderBy: { id: 'asc' },
    include: {
      rosterPlayers: {
        include: {
          roster: { select: { tournamentId: true } },
        },
      },
    },
  });
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
  const dup = await client.player.findFirst({ where: { name: data.name } });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const player = await client.player.create({ data });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return player;
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
    player = await client.player.update({ where: { id: existing.id }, data });
  } else {
    player = await client.player.create({ data });
  }
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return player;
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
  const dup = await client.player.findFirst({
    where: {
      name: data.name,
      NOT: { id },
    },
  });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const player = await client.player.update({ where: { id }, data });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }], client);
  }
  return player;
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
) {
  const where = { tournamentId_title: { tournamentId, title } } as const;
  return client.roster.upsert({
    where,
    update: {},
    create: { tournamentId, title, date: new Date() },
  });
}

/** Ensure a tournament exists and return its latest roster, creating one if needed. */
export async function ensureTournamentRoster(
  name: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const tournament = await upsertTournament(name, client);
  let roster = await client.roster.findFirst({
    where: { tournamentId: tournament.id },
    orderBy: { date: 'desc' },
  });
  if (!roster) {
    const title = `${tournament.name} (${new Date().toISOString().slice(0, 10)})`;
    roster = await client.roster.create({
      data: { tournamentId: tournament.id, title, date: new Date() },
    });
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
  if (typeof (client as any).$transaction === 'function') {
    await (client as any).$transaction(upserts);
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
) {
  const t = await upsertTournament(tournament, client);
  const r = await upsertRoster(t.id, rosterTitle, client);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Upsert by slug then link players. */
export async function upsertTournamentRosterPlayersBySlug(
  slug: string,
  tournament: string,
  rosterTitle: string,
  players: { playerId: number; number?: number; position?: string[] }[],
  client: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const t = await upsertTournamentBySlug(slug, tournament, client);
  const r = await upsertRoster(t.id, rosterTitle, client);
  await addRosterPlayers(r.id, players, client);
  return r;
}

/** Get all rosters ordered by date. */
export async function getRosters(slug?: string) {
  return prisma.roster.findMany({
    where: slug ? { tournament: { slug } } : undefined,
    orderBy: { date: 'asc' },
    include: { tournament: true },
  });
}

/** Get all tournaments. */
export async function getTournaments() {
  return prisma.tournament.findMany({
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
