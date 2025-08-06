import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma, { getPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  player: { findMany: any };
};

describe('getPlayers user-specific', () => {
  beforeEach(() => {
    mockPrisma.player.findMany = vi.fn();
  });

  it('excludes overridden global players', async () => {
    mockPrisma.player.findMany
      .mockResolvedValueOnce([{ basePlayerId: 1 }, { basePlayerId: 2 }])
      .mockResolvedValueOnce([
        { id: 3, name: 'User', position: ['MF'], userId: 5, isDeleted: false },
      ]);
    const res = await getPlayers(undefined, 5);
    expect(res).toEqual([
      {
        id: 3,
        name: 'User',
        position: ['MF'],
        userId: 5,
        isDeleted: false,
        role: 'player',
      },
    ]);
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(2);
  });
});
