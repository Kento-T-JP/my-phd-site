import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    user: { update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let prisma: any;
let sessionSpy: any;

describe('admin user API', () => {
  beforeEach(async () => {
    const db = await import('@/lib/db');
    prisma = db.default as any;
    prisma.user.update.mockReset();
    prisma.user.delete.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.$transaction.mockReset();

    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });
  });

  it('promotes a user to admin', async () => {
    const { PATCH } = await import('../src/app/api/admin/users/[id]/route');
    prisma.user.update.mockResolvedValue({
      id: 1,
      email: 'u@test.com',
      emailVerified: null,
      isAdmin: true,
    });
    const req = new Request('http://test', {
      method: 'PATCH',
      body: JSON.stringify({ isAdmin: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isAdmin).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isAdmin: true },
      select: { id: true, email: true, emailVerified: true, isAdmin: true },
    });
  });

  it('demotes an admin user', async () => {
    const { PATCH } = await import('../src/app/api/admin/users/[id]/route');
    prisma.user.update.mockResolvedValue({
      id: 2,
      email: 'a2@test.com',
      emailVerified: null,
      isAdmin: false,
    });
    const req = new Request('http://test', {
      method: 'PATCH',
      body: JSON.stringify({ isAdmin: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '2' }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isAdmin).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isAdmin: false },
      select: { id: true, email: true, emailVerified: true, isAdmin: true },
    });
  });

  it('deletes a user', async () => {
    const { DELETE } = await import('../src/app/api/admin/users/[id]/route');
    prisma.user.findUnique.mockResolvedValue({ id: 3, email: 'u3@test.com' });
    const tx = {
      player: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      roster: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      favoritePlayer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      formation: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      formationNode: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      rosterPlayer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      tournament: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      pendingRegistration: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        delete: vi.fn().mockResolvedValue({ id: 3 }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '3' }),
    } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
