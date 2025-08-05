import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  getAdminStats: vi.fn(),
  default: {},
}));

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let statsSpy: any;
let sessionSpy: any;

describe('admin stats API', () => {
  beforeEach(async () => {
    const db = await import('@/lib/db');
    statsSpy = db.getAdminStats as any;
    statsSpy.mockReset();

    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
  });

  it('returns stats for admin', async () => {
    statsSpy.mockResolvedValue({
      totalUsers: 1,
      verifiedUsers: 1,
      totalFormations: 1,
      totalContactInquiries: 1,
      registrationsLast7Days: 1,
      pageViews: 10,
      siteVisitors: 5,
    });
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });
    const { GET } = await import('../src/app/api/admin/stats/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalUsers).toBe(1);
    expect(data.pageViews).toBe(10);
    expect(statsSpy).toHaveBeenCalled();
  });

  it('blocks non-admin', async () => {
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: false } });
    const { GET } = await import('../src/app/api/admin/stats/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
