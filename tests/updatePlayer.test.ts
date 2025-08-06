import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma, { updatePlayer } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  player: { findFirst: any; update: any };
};

describe('updatePlayer', () => {
  beforeEach(() => {
    mockPrisma.player.findFirst = vi.fn();
    mockPrisma.player.update = vi.fn();
  });

  it('throws on duplicate name', async () => {
    mockPrisma.player.findFirst.mockResolvedValue({ id: 2 });
    await expect(
      updatePlayer(1, { name: 'John', position: ['GK'], role: 'player' })
    ).rejects.toThrow('同じ名前の選手が既に存在します');
    expect(mockPrisma.player.findFirst).toHaveBeenCalledWith({
      where: { name: 'John', userId: null, NOT: { id: 1 } },
    });
  });

  it('updates when no duplicate', async () => {
    mockPrisma.player.findFirst.mockResolvedValue(null);
    mockPrisma.player.update.mockResolvedValue({ id: 1, name: 'John', position: ['GK'] });
    const res = await updatePlayer(1, { name: 'John', position: ['GK'], role: 'player' });
    expect(mockPrisma.player.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'John', position: ['GK'] } });
    expect(res.id).toBe(1);
  });

  it('checks duplicates per user', async () => {
    mockPrisma.player.findFirst.mockResolvedValue(null);
    mockPrisma.player.update.mockResolvedValue({ id: 1, name: 'John', position: ['GK'], userId: 3 });
    await updatePlayer(1, { name: 'John', position: ['GK'], role: 'player', userId: 3 });
    expect(mockPrisma.player.findFirst).toHaveBeenCalledWith({
      where: { name: 'John', userId: 3, NOT: { id: 1 } },
    });
  });
});
