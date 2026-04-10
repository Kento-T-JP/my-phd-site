import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/sessionUser", () => ({
  __esModule: true,
  resolveSessionUserId: vi.fn(),
}));

vi.mock("@/lib/formationAccess", () => ({
  __esModule: true,
  getFormationScopeOwnerId: vi.fn(),
}));

vi.mock("@/lib/cacheRuntime", () => ({
  __esModule: true,
  revalidateTagSafe: vi.fn(),
  runWithCache: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/cacheTags", () => ({
  __esModule: true,
  cacheTag: {
    rosters: (userId: number) => `rosters:${userId}`,
    rostersTitles: (userId: number) => `rostersTitles:${userId}`,
    positions: (userId: number) => `positions:${userId}`,
  },
}));

vi.mock("@/lib/defaultPositions", () => ({
  __esModule: true,
  getDefaultPositions: () => [],
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    userPosition: {
      findMany: vi.fn(),
    },
  },
  getPlayers: vi.fn(),
  getRosters: vi.fn(),
}));

describe("formation scoped resources", () => {
  let getPlayersSpy: any;
  let getRostersSpy: any;
  let prisma: any;
  let resolveSessionUserIdSpy: any;
  let getFormationScopeOwnerIdSpy: any;
  let getServerSessionSpy: any;

  beforeEach(async () => {
    const db = await import("@/lib/db");
    getPlayersSpy = db.getPlayers as any;
    getRostersSpy = db.getRosters as any;
    prisma = db.default as any;
    getPlayersSpy.mockReset();
    getRostersSpy.mockReset();
    prisma.userPosition.findMany.mockReset();

    const sessionUser = await import("@/lib/sessionUser");
    resolveSessionUserIdSpy = sessionUser.resolveSessionUserId as any;
    resolveSessionUserIdSpy.mockReset();
    resolveSessionUserIdSpy.mockResolvedValue({ userId: 7, isAdmin: false });

    const formationAccess = await import("@/lib/formationAccess");
    getFormationScopeOwnerIdSpy = formationAccess.getFormationScopeOwnerId as any;
    getFormationScopeOwnerIdSpy.mockReset();
    getFormationScopeOwnerIdSpy.mockResolvedValue(11);

    const nextAuth = await import("next-auth/next");
    getServerSessionSpy = nextAuth.getServerSession as any;
    getServerSessionSpy.mockReset();
    getServerSessionSpy.mockResolvedValue({ user: { id: "7", email: "collab@test.com" } });
  });

  it("loads players from the formation owner scope", async () => {
    getPlayersSpy.mockResolvedValue([]);
    const { GET } = await import("../src/app/api/players/route");
    const res = await GET(new Request("http://test/api/players?formationId=5"));
    expect(res.status).toBe(200);
    expect(getFormationScopeOwnerIdSpy).toHaveBeenCalledWith(5, 7);
    expect(getPlayersSpy).toHaveBeenCalledWith(undefined, 11, {
      includeImage: true,
      includeExtra: true,
      includeRosterLinks: false,
    });
  });

  it("loads rosters from the formation owner scope", async () => {
    getRostersSpy.mockResolvedValue([]);
    const { GET } = await import("../src/app/api/rosters/route");
    const res = await GET(new Request("http://test/api/rosters?formationId=5"));
    expect(res.status).toBe(200);
    expect(getFormationScopeOwnerIdSpy).toHaveBeenCalledWith(5, 7);
    expect(getRostersSpy).toHaveBeenCalledWith(undefined, 11);
  });

  it("loads positions from the formation owner scope", async () => {
    prisma.userPosition.findMany.mockResolvedValue([]);
    const { GET } = await import("../src/app/api/positions/route");
    const res = await GET(new Request("http://test/api/positions?formationId=5"));
    expect(res.status).toBe(200);
    expect(getFormationScopeOwnerIdSpy).toHaveBeenCalledWith(5, 7);
    expect(prisma.userPosition.findMany).toHaveBeenCalledWith({
      where: { userId: 11 },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  });
});
