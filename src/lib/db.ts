// ESM 接続専用
import { PrismaClient } from '@prisma/client';
import type { Player } from '@/types/player';

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
    include: { rosterPlayers: true },
  });
}

/**
 * 新しい選手レコードを追加します。
 * ID は Prisma によって自動的に採番されます。
 */
export async function createPlayer(
  data: Omit<Player, 'id'>,
  rosterId?: number,
) {
  const dup = await prisma.player.findFirst({ where: { name: data.name } });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const player = await prisma.player.create({ data });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }]);
  }
  return player;
}

/**
 * 名前をキーに既存レコードを更新、なければ新規作成します。
 */
export async function upsertPlayer(
  data: Omit<Player, 'id'>,
  rosterId?: number,
) {
  const existing = await prisma.player.findFirst({ where: { name: data.name } });
  let player;
  if (existing) {
    player = await prisma.player.update({ where: { id: existing.id }, data });
  } else {
    player = await prisma.player.create({ data });
  }
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }]);
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
) {
  const dup = await prisma.player.findFirst({
    where: {
      name: data.name,
      NOT: { id },
    },
  });
  if (dup) {
    throw new Error('同じ名前の選手が既に存在します');
  }
  const player = await prisma.player.update({ where: { id }, data });
  if (rosterId) {
    await addRosterPlayers(rosterId, [{ playerId: player.id }]);
  }
  return player;
}

/** Upsert a tournament by name. */
export async function upsertTournament(name: string) {
  const existing = await prisma.tournament.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.tournament.create({ data: { name } });
}

/** Upsert a roster by (tournamentId, date). */
export async function upsertRoster(tournamentId: number, date: Date) {
  const existing = await prisma.roster.findFirst({ where: { tournamentId, date } });
  if (existing) return existing;
  return prisma.roster.create({ data: { tournamentId, date } });
}

/** Link players to a roster, skipping duplicates. */
export async function addRosterPlayers(
  rosterId: number,
  players: { playerId: number; number?: number; position?: string[] }[],
) {
  if (players.length === 0) return;
  const upserts = players.map((p) =>
    prisma.rosterPlayer.upsert({
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
  await prisma.$transaction(upserts);
}

/** Get all rosters ordered by date. */
export async function getRosters() {
  return prisma.roster.findMany({
    orderBy: { date: 'asc' },
    include: { tournament: true },
  });
}
