import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  userPosition: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  player: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  rosterPlayer: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const getServerSessionMock = vi.fn();
vi.mock("next-auth/next", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("@/lib/authOptions", () => ({
  authOptions: {},
}));

const resolveSessionUserIdMock = vi.fn();
vi.mock("@/lib/sessionUser", () => ({
  resolveSessionUserId: (...args: unknown[]) => resolveSessionUserIdMock(...args),
}));

const revalidateTagSafeMock = vi.fn();
vi.mock("@/lib/cacheRuntime", () => ({
  revalidateTagSafe: (...args: unknown[]) => revalidateTagSafeMock(...args),
  runWithCache: vi.fn(),
}));

describe("DELETE /api/positions cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "1", email: "a@test.com" } });
    resolveSessionUserIdMock.mockResolvedValue({ userId: 1, isAdmin: false });
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<void>) => {
      await cb(mockPrisma);
    });
  });

  it("removes deleted position from players and rosterPlayers", async () => {
    mockPrisma.userPosition.findFirst.mockResolvedValue({ id: 7, name: "RWB" });
    mockPrisma.userPosition.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.player.findMany.mockResolvedValue([
      { id: 10, position: ["GK", "RWB"] },
      { id: 11, position: ["DF"] },
    ]);
    mockPrisma.rosterPlayer.findMany.mockResolvedValue([
      { rosterId: 20, playerId: 10, position: ["RWB", "DF"] },
      { rosterId: 21, playerId: 11, position: ["MF"] },
    ]);
    mockPrisma.player.update.mockResolvedValue({});
    mockPrisma.rosterPlayer.update.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/positions/route");
    const req = new Request("http://localhost/api/positions", {
      method: "DELETE",
      body: JSON.stringify({ positionId: 7 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.player.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { position: ["GK"] },
    });
    expect(mockPrisma.rosterPlayer.update).toHaveBeenCalledWith({
      where: { rosterId_playerId: { rosterId: 20, playerId: 10 } },
      data: { position: ["DF"] },
    });
  });
});

