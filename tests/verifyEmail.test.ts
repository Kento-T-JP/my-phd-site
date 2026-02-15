import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    pendingRegistration: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  const db = await import('@/lib/db');
  prisma = db.default as any;
  prisma.pendingRegistration.findUnique.mockReset();
  prisma.pendingRegistration.delete.mockReset();
  prisma.user.findUnique.mockReset();
  prisma.user.create.mockReset();
  prisma.user.update.mockReset();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

describe('verify email API', () => {
  it('verifies token and updates user', async () => {
    const { GET } = await import('../src/app/api/verify-email/route');
    prisma.pendingRegistration.findUnique.mockResolvedValue({
      token: 'tok',
      email: 'test@example.com',
      hashedPassword: 'hashed',
      expires: new Date(Date.now() + 1000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
    });
    const res = await GET(new Request('http://test/api/verify-email?token=tok'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
      data: { emailVerified: expect.any(Date), status: 'active' },
    });
    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({
      where: { token: 'tok' },
    });
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('returns 400 for invalid token', async () => {
    const { GET } = await import('../src/app/api/verify-email/route');
    prisma.pendingRegistration.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://test/api/verify-email?token=bad'));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
