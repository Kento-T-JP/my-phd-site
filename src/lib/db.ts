// ESM 接続専用
import { PrismaClient } from '@prisma/client';

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