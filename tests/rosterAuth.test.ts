import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const prisma = { roster: { findUnique: vi.fn(async () => null) } } as any;
  return {
    __esModule: true,
    default: prisma,
    ensureTournamentRoster: vi.fn(async () => ({ id: 1 })),
    getRosters: vi.fn(),
  };
});

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

describe('roster API authorization', () => {
  let sessionSpy: any;
  let ensureSpy: any;

  beforeEach(async () => {
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    const db = await import('@/lib/db');
    ensureSpy = db.ensureTournamentRoster as any;
    ensureSpy.mockReset();
  });

  it('allows authenticated non-admin to create roster and records user id', async () => {
    const { POST } = await import('../src/app/api/rosters/route');
    sessionSpy.mockResolvedValue({ user: { id: '42', email: 'u@test.com', isAdmin: false } });
    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ tournament: 'T' }),
      }),
    );
    expect(res.status).toBe(201);
    expect(ensureSpy).toHaveBeenCalledWith('T', 42, expect.anything());
  });

  it('rejects unauthenticated users', async () => {
    const { POST } = await import('../src/app/api/rosters/route');
    sessionSpy.mockResolvedValue(null);
    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ tournament: 'T' }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
