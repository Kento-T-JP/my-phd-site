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
    mockPrisma.player.findMany.mockResolvedValueOnce([
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
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(1);
  });

  it('hides other users and preserves globals', async () => {
    mockPrisma.player.findMany
      .mockResolvedValueOnce([
        {
          id: 3,
          name: 'Override',
          position: ['FW'],
          userId: 5,
          basePlayerId: 2,
          isDeleted: false,
        },
      ])
      .mockResolvedValueOnce([{ id: 9, name: 'Other', position: ['GK'], userId: 6, isDeleted: false }]);
    const userRes = await getPlayers(undefined, 5);
    const otherRes = await getPlayers(undefined, 6);
    expect(userRes.map((p) => p.name)).toEqual(['Override']);
    expect(otherRes.map((p) => p.name)).toEqual(['Other']);
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(2);
  });
});
