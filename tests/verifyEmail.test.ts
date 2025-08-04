import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    emailVerificationToken: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  const db = await import('@/lib/db');
  prisma = db.default as any;
  prisma.emailVerificationToken.findUnique.mockReset();
  prisma.emailVerificationToken.delete.mockReset();
  prisma.user.update.mockReset();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

describe('verify email API', () => {
  it('verifies token and updates user', async () => {
    const { GET } = await import('../src/app/api/verify-email/route');
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      token: 'tok',
      userId: 1,
      expires: new Date(Date.now() + 1000),
    });
    const res = await GET(new Request('http://test/api/verify-email?token=tok'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({
      where: { token: 'tok' },
    });
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('returns 400 for invalid token', async () => {
    const { GET } = await import('../src/app/api/verify-email/route');
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://test/api/verify-email?token=bad'));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
