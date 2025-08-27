import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

let resendSendMock: any;
let fetchMock: any;
const originalFetch = global.fetch;

vi.mock('resend', () => {
  resendSendMock = vi.fn().mockResolvedValue({});
  return {
    __esModule: true,
    Resend: vi.fn(() => ({ emails: { send: resendSendMock } })),
  };
});

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  const mock = { ...actual, randomBytes: () => Buffer.from('mocktoken') };
  return { ...mock, default: mock };
});


vi.mock('bcrypt', () => ({
  __esModule: true,
  hash: vi.fn(async () => 'hashed'),
}));

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    emailVerificationToken: { create: vi.fn() },
  },
}));

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  resendSendMock = vi.fn().mockResolvedValue({});
  const db = await import('@/lib/db');
  prisma = db.default as any;
  prisma.user.findUnique.mockReset();
  prisma.user.create.mockReset();
  prisma.emailVerificationToken.create.mockReset();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.CONFIRM_FROM_ADDRESS = 'no-reply@test';
  process.env.RECAPTCHA_SECRET_KEY = 'secret';
  fetchMock = vi.fn(async () => ({ json: async () => ({ success: true }) }));
  // @ts-ignore
  global.fetch = fetchMock;
});

afterEach(() => {
  // @ts-ignore
  global.fetch = originalFetch;
  delete process.env.RECAPTCHA_SECRET_KEY;
});

describe('register API', () => {
  it('creates user and sends verification email', async () => {
    const { POST } = await import('../src/app/api/register/route');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      isAdmin: false,
    });
    const req = new Request('http://test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'pass',
        recaptchaToken: 'token',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const tokenHex = Buffer.from('mocktoken').toString('hex');
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: { token: tokenHex, userId: 1, expires: expect.any(Date) },
    });
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.to).toBe('test@example.com');
    expect(payload.html).toContain(tokenHex);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 400 if captcha verification fails', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false }) });
    const { POST } = await import('../src/app/api/register/route');
    prisma.user.findUnique.mockResolvedValue(null);
    const req = new Request('http://test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'pass',
        recaptchaToken: 'bad',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });
});
