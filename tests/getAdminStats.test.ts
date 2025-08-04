import { describe, it, beforeEach, expect, vi } from 'vitest';
import prisma, { getAdminStats } from '@/lib/db';

const mockPrisma = prisma as unknown as {
  user: { count: any };
  formation: { count: any };
  contactSubmission: { count: any };
};

describe('getAdminStats', () => {
  beforeEach(() => {
    mockPrisma.user.count = vi.fn();
    mockPrisma.formation.count = vi.fn();
    mockPrisma.contactSubmission.count = vi.fn();
  });

  it('computes counts correctly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-08T00:00:00Z'));
    mockPrisma.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    mockPrisma.formation.count.mockResolvedValue(5);
    mockPrisma.contactSubmission.count.mockResolvedValue(3);

    const stats = await getAdminStats();
    expect(stats).toEqual({
      totalUsers: 10,
      verifiedUsers: 4,
      totalFormations: 5,
      totalContactInquiries: 3,
      registrationsLast7Days: 2,
    });
    expect(mockPrisma.user.count.mock.calls[0]).toEqual([]);
    expect(mockPrisma.user.count).toHaveBeenNthCalledWith(2, {
      where: { emailVerified: { not: null } },
    });
    expect(mockPrisma.user.count).toHaveBeenNthCalledWith(3, {
      where: { createdAt: { gte: new Date('2024-01-01T00:00:00.000Z') } },
    });
    expect(mockPrisma.formation.count).toHaveBeenCalled();
    expect(mockPrisma.contactSubmission.count).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
