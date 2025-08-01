import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma, { syncRosterPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  rosterPlayer: { findUnique: any; create: any; delete: any };
};

describe('syncRosterPlayers', () => {
  beforeEach(() => {
    mockPrisma.rosterPlayer.findUnique = vi.fn();
    mockPrisma.rosterPlayer.create = vi.fn();
    mockPrisma.rosterPlayer.delete = vi.fn();
  });

  it('creates when missing', async () => {
    mockPrisma.rosterPlayer.findUnique.mockResolvedValue(null);
    await syncRosterPlayers(1, 2);
    expect(mockPrisma.rosterPlayer.create).toHaveBeenCalledWith({
      data: { playerId: 1, rosterId: 2 },
    });
  });

  it('deletes when exists', async () => {
    mockPrisma.rosterPlayer.findUnique.mockResolvedValue({});
    await syncRosterPlayers(3, 4);
    expect(mockPrisma.rosterPlayer.delete).toHaveBeenCalledWith({
      where: { rosterId_playerId: { rosterId: 4, playerId: 3 } },
    });
  });
});
