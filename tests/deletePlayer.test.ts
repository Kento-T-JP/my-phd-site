import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const prisma = {
    player: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
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
    prisma.player.findUnique.mockReset();
    prisma.player.update.mockReset();
    prisma.player.create.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
  });

  it('requires authentication', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue(null);
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('blocks non-owner without admin', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { id: 1, isAdmin: false } });
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 2, name: 'A', position: [] });
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('soft deletes owned player', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { id: 1, isAdmin: false } });
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1, name: 'A', position: [] });
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(200);
    expect(prisma.player.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isDeleted: true } });
  });

  it('creates override when deleting global player', async () => {
    const { DELETE } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { id: 5, isAdmin: false } });
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: null, name: 'G', position: ['GK'], number: 1, image: null, wikiUrl: null });
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(403);
    expect(prisma.player.create).not.toHaveBeenCalled();
  });
});
