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
    const res = await getPlayers(undefined);
    expect(res).toEqual([]);
    expect(mockPrisma.player.findMany).not.toHaveBeenCalled();
  });
});
