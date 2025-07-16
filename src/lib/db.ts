// ESM 接続専用
import { PrismaClient } from '@prisma/client';
import type { Player } from '@/types/player';

const prisma = new PrismaClient();

export default prisma;

/**
 * すべての選手を id 昇順で取得するユーティリティ関数。
 * API ルート（/api/players）などから呼び出して使用します。
 */
export async function getPlayers() {
  return prisma.player.findMany({
    orderBy: { id: 'asc' }
  });
}

/**
 * 新しい選手レコードを追加します。
 * ID は Prisma によって自動的に採番されます。
 */
export async function createPlayer(data: Omit<Player, 'id'>) {
  const dup = await prisma.player.findFirst({ where: { name: data.name } });
  if (dup) {
    throw new Error('Player with this name already exists');
  }
  return prisma.player.create({ data });
}

/**
 * 名前をキーに既存レコードを更新、なければ新規作成します。
 */
export async function upsertPlayer(data: Omit<Player, 'id'>) {
  const existing = await prisma.player.findFirst({ where: { name: data.name } });
  if (existing) {
    return prisma.player.update({ where: { id: existing.id }, data });
  }
  return prisma.player.create({ data });
}

/**
 * Update an existing player by id.
 * Throws if another player already has the same name.
 */
export async function updatePlayer(id: number, data: Omit<Player, 'id'>) {
  const dup = await prisma.player.findFirst({
    where: {
      name: data.name,
      NOT: { id },
    },
  });
  if (dup) {
    throw new Error('Player with this name already exists');
  }
  return prisma.player.update({ where: { id }, data });
}
