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

  it('hides other users and preserves globals', async () => {
    mockPrisma.player.findMany
      .mockResolvedValueOnce([{ basePlayerId: 2 }])
      .mockResolvedValueOnce([
        { id: 1, name: 'G1', position: ['GK'], userId: null, isDeleted: false },
        {
          id: 3,
          name: 'Override',
          position: ['FW'],
          userId: 5,
          basePlayerId: 2,
          isDeleted: false,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, name: 'G1', position: ['GK'], userId: null, isDeleted: false },
        { id: 2, name: 'G2', position: ['FW'], userId: null, isDeleted: false },
      ]);
    const userRes = await getPlayers(undefined, 5);
    const otherRes = await getPlayers(undefined, 6);
    expect(userRes.map((p) => p.name)).toEqual(['G1', 'Override']);
    expect(otherRes.map((p) => p.name)).toEqual(['G1', 'G2']);
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(4);
  });
});
