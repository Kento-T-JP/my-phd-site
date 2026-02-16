import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma, { addRosterPlayers, getPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  rosterPlayer: { upsert: any; createMany: any };
  $transaction: any;
  roster: { findFirst: any };
  player: { findMany: any };
};

describe('RosterPlayer fields', () => {
  beforeEach(() => {
    mockPrisma.rosterPlayer.upsert = vi.fn();
    mockPrisma.rosterPlayer.createMany = vi.fn();
    mockPrisma.$transaction = vi.fn(async (ops: any[]) => Promise.all(ops));
    mockPrisma.roster.findFirst = vi.fn();
    mockPrisma.player.findMany = vi.fn();
  });

  it('addRosterPlayers inserts number and position', async () => {
    mockPrisma.rosterPlayer.createMany.mockResolvedValue({ count: 1 });
    await addRosterPlayers(1, [
      { playerId: 2, number: 10, position: ['GK'] },
    ]);
    expect(mockPrisma.rosterPlayer.createMany).toHaveBeenCalledWith({
      data: [
        {
          rosterId: 1,
          playerId: 2,
          number: 10,
          position: ['GK'],
        },
      ],
      skipDuplicates: true,
    });
  });

  it('getPlayers returns roster-specific fields', async () => {
    mockPrisma.roster.findFirst.mockResolvedValue({
      players: [
        {
          playerId: 2,
          number: 10,
          position: ['GK'],
          player: { id: 2, name: 'John', number: 99, position: ['DF'] },
        },
      ],
    });
    const players = await getPlayers(1, 1);
    expect(players).toEqual([
      { id: 2, name: 'John', number: 10, position: ['GK'], role: 'player' },
    ]);
  });

  it('addRosterPlayers works without $transaction', async () => {
    const client = {
      rosterPlayer: { upsert: vi.fn().mockResolvedValue({}) },
    } as any;
    await addRosterPlayers(1, [{ playerId: 3 }], client);
    expect(client.rosterPlayer.upsert).toHaveBeenCalled();
  });
});
