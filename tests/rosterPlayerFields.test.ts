import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma, { addRosterPlayers, getPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  rosterPlayer: { createMany: any };
  roster: { findUnique: any };
};

describe('RosterPlayer fields', () => {
  beforeEach(() => {
    mockPrisma.rosterPlayer.createMany = vi.fn();
    mockPrisma.roster.findUnique = vi.fn();
  });

  it('addRosterPlayers inserts number and position', async () => {
    mockPrisma.rosterPlayer.createMany.mockResolvedValue({ count: 1 });
    await addRosterPlayers(1, [
      { playerId: 2, number: 10, position: ['GK'] },
    ]);
    expect(mockPrisma.rosterPlayer.createMany).toHaveBeenCalledWith({
      data: [
        { rosterId: 1, playerId: 2, number: 10, position: ['GK'] },
      ],
      skipDuplicates: true,
    });
  });

  it('getPlayers returns roster-specific fields', async () => {
    mockPrisma.roster.findUnique.mockResolvedValue({
      players: [
        {
          playerId: 2,
          number: 10,
          position: ['GK'],
          player: { id: 2, name: 'John', number: 99, position: ['DF'] },
        },
      ],
    });
    const players = await getPlayers(1);
    expect(players).toEqual([
      { id: 2, name: 'John', number: 10, position: ['GK'] },
    ]);
  });
});
