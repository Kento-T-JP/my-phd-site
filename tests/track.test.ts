import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: { visit: { create: vi.fn() } },
}));

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/db');
  prisma = mod.default as any;
  prisma.visit.create.mockReset();
});

describe('track API route', () => {
  it('records visits for non-bot user agents', async () => {
    const { POST } = await import('../src/app/api/track/route');
    prisma.visit.create.mockResolvedValue({});
    const req = new Request('http://test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '2.2.2.2',
      },
      body: JSON.stringify({ path: '/foo' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: { path: '/foo', ip: '2.2.2.2', userAgent: 'Mozilla/5.0', isBot: false },
    });
  });

  it('ignores bot visits', async () => {
    const { POST } = await import('../src/app/api/track/route');
    const req = new Request('http://test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Googlebot',
        'x-forwarded-for': '2.2.2.2',
      },
      body: JSON.stringify({ path: '/foo' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });
});
