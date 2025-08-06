import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const prisma = {
    favoritePlayer: { deleteMany: vi.fn() },
    formationNode: { deleteMany: vi.fn() },
    rosterPlayer: { deleteMany: vi.fn() },
    player: { delete: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  } as any;
  return { __esModule: true, default: prisma };
});

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let prisma: any;
let sessionSpy: any;

describe('DELETE /api/players/[id]', () => {
  beforeEach(async () => {
    const db = await import('@/lib/db');
    prisma = db.default as any;
    prisma.favoritePlayer.deleteMany.mockReset();
    prisma.formationNode.deleteMany.mockReset();
    prisma.rosterPlayer.deleteMany.mockReset();
    prisma.player.delete.mockReset();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
  });

  it('requires admin', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { isAdmin: false } });
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('deletes player and related data', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { isAdmin: true } });
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(200);
    expect(prisma.favoritePlayer.deleteMany).toHaveBeenCalledWith({ where: { playerId: 1 } });
    expect(prisma.formationNode.deleteMany).toHaveBeenCalledWith({ where: { playerId: 1 } });
    expect(prisma.rosterPlayer.deleteMany).toHaveBeenCalledWith({ where: { playerId: 1 } });
    expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
