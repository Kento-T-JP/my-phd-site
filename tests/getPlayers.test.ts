import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma, { getPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  player: { findMany: any };
};

describe('getPlayers without user', () => {
  beforeEach(() => {
    mockPrisma.player.findMany = vi.fn();
  });

  it('excludes user-specific players when no userId', async () => {
    mockPrisma.player.findMany.mockResolvedValueOnce([
      { id: 1, name: 'G1', position: ['GK'], userId: null, isDeleted: false },
    ]);
    const res = await getPlayers(undefined);
    expect(res).toEqual([
      {
        id: 1,
        name: 'G1',
        position: ['GK'],
        userId: null,
        isDeleted: false,
        role: 'player',
      },
    ]);
    expect(mockPrisma.player.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.player.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ isDeleted: false, userId: null });
  });
});

