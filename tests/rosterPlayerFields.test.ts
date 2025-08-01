import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma, { addRosterPlayers, getPlayers } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  rosterPlayer: { upsert: any };
  $transaction: any;
  roster: { findUnique: any };
};

describe('RosterPlayer fields', () => {
  beforeEach(() => {
    mockPrisma.rosterPlayer.upsert = vi.fn();
    mockPrisma.$transaction = vi.fn(async (ops: any[]) => Promise.all(ops));
    mockPrisma.roster.findUnique = vi.fn();
  });

  it('addRosterPlayers inserts number and position', async () => {
    mockPrisma.rosterPlayer.upsert.mockResolvedValue({});
    await addRosterPlayers(1, [
      { playerId: 2, number: 10, position: ['GK'] },
    ]);
    expect(mockPrisma.rosterPlayer.upsert).toHaveBeenCalledWith({
      where: { rosterId_playerId: { rosterId: 1, playerId: 2 } },
      update: {},
      create: {
        rosterId: 1,
        playerId: 2,
        number: 10,
        position: ['GK'],
      },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
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

  it('addRosterPlayers works without $transaction', async () => {
    const client = {
      rosterPlayer: { upsert: vi.fn().mockResolvedValue({}) },
    } as any;
    const spy = vi.spyOn(Promise, 'all');
    await addRosterPlayers(1, [{ playerId: 3 }], client);
    expect(client.rosterPlayer.upsert).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
