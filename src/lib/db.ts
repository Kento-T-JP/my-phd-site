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
 * 既存の id の最大値に 1 を足した値を採番して保存します。
 */
export async function createPlayer(data: Omit<Player, 'id'>) {
  const dup = await prisma.player.findFirst({ where: { name: data.name } });
  if (dup) {
    throw new Error('Player with this name already exists');
  }
  const max = await prisma.player.aggregate({ _max: { id: true } });
  const nextId = (max._max.id ?? 0) + 1;
  return prisma.player.create({ data: { ...data, id: nextId } });
}

/**
 * 名前をキーに既存レコードを更新、なければ新規作成します。
 */
export async function upsertPlayer(data: Omit<Player, 'id'>) {
  const existing = await prisma.player.findFirst({ where: { name: data.name } });
  if (existing) {
    return prisma.player.update({ where: { id: existing.id }, data });
  }
  const max = await prisma.player.aggregate({ _max: { id: true } });
  const nextId = (max._max.id ?? 0) + 1;
  return prisma.player.create({ data: { ...data, id: nextId } });
}
