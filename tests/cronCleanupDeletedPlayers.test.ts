import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    player: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  const db = await import("@/lib/db");
  prisma = db.default as any;
  prisma.player.findMany.mockReset();
  prisma.$transaction.mockReset();
  process.env.CRON_SECRET = "test-secret";
});

describe("cleanup deleted players cron API", () => {
  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("../src/app/api/cron/cleanup-deleted-players/route");
    const req = new Request("http://localhost:3000/api/cron/cleanup-deleted-players");
    const res = await GET(req as any);
    expect(res.status).toBe(401);
    expect(prisma.player.findMany).not.toHaveBeenCalled();
  });

  it("deletes stale soft-deleted players when authorized", async () => {
    prisma.player.findMany.mockResolvedValue([{ id: 11 }, { id: 22 }]);
    prisma.$transaction.mockImplementation(async (runner: any) =>
      runner({
        favoritePlayer: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        rosterPlayer: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
        formationNode: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        player: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      }),
    );

    const { GET } = await import("../src/app/api/cron/cleanup-deleted-players/route");
    const req = new Request("http://localhost:3000/api/cron/cleanup-deleted-players", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });
    const res = await GET(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deletedPlayers).toBe(2);
    expect(data.deletedFavorites).toBe(3);
    expect(data.deletedRosterLinks).toBe(4);
    expect(data.deletedFormationNodes).toBe(2);
    expect(prisma.player.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
