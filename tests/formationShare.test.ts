import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  const mock = {
    ...actual,
    randomBytes: () => Buffer.from("sharetokenvalue"),
  };
  return { ...mock, default: mock };
});

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: vi.fn(),
    },
    formation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    formationShare: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    player: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    visit: {
      create: vi.fn(),
    },
  },
}));

let prisma: any;
let getServerSession: any;

beforeEach(async () => {
  vi.resetModules();
  const db = await import("@/lib/db");
  prisma = db.default as any;
  const nextAuth = await import("next-auth/next");
  getServerSession = (nextAuth as any).getServerSession;
  getServerSession.mockReset();
  prisma.user.findUnique.mockReset();
  prisma.formation.findUnique.mockReset();
  prisma.formation.findFirst.mockReset();
  prisma.formation.create.mockReset();
  prisma.formationShare.create.mockReset();
  prisma.formationShare.findUnique.mockReset();
  prisma.player.findMany.mockReset();
  prisma.player.create.mockReset();
  prisma.visit.create.mockReset();
  prisma.visit.create.mockResolvedValue({ id: 1 });
});

describe("formation share API", () => {
  it("creates a share link for owned formation", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@test.com" } });
    prisma.user.findUnique.mockResolvedValue({ id: 10, email: "owner@test.com" });
    prisma.formation.findUnique.mockResolvedValue({
      id: 3,
      userId: 10,
      name: "Test",
      positions: {
        lineupOrder: [1],
        benchOrder: [2],
        playerPositions: {
          "1": { top: 20, left: 40 },
        },
        baseFormationName: "4-3-3",
      },
    });
    prisma.player.findMany.mockResolvedValue([
      {
        id: 1,
        name: "A",
        position: ["MF"],
        number: 8,
        image: null,
        wikiUrl: null,
      },
      {
        id: 2,
        name: "B",
        position: ["FW"],
        number: 9,
        image: null,
        wikiUrl: null,
      },
    ]);
    prisma.formationShare.create.mockResolvedValue({ id: 99 });

    const { POST } = await import("../src/app/api/formation-shares/route");
    const req = new Request("http://localhost:3000/api/formation-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formationId: 3 }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.shareUrl).toContain("/share/");
    expect(prisma.formationShare.create).toHaveBeenCalledTimes(1);
  });

  it("imports a shared formation and reuses same-name player", async () => {
    getServerSession.mockResolvedValue({ user: { email: "importer@test.com" } });
    prisma.user.findUnique.mockResolvedValue({ id: 20, email: "importer@test.com" });
    prisma.formationShare.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      payload: {
        formationName: "Shared 4-4-2",
        sourceFormationId: 7,
        baseFormationName: "4-4-2",
        lineupOrder: [100, 101],
        benchOrder: [102],
        playerPositions: {
          "100": { top: 10, left: 20 },
          "101": { top: 20, left: 30 },
        },
        players: [
          {
            sourcePlayerId: 100,
            name: "Same Name",
            position: ["MF"],
            number: 7,
            image: null,
            wikiUrl: null,
          },
          {
            sourcePlayerId: 101,
            name: "New Name",
            position: ["FW"],
            number: 9,
            image: null,
            wikiUrl: null,
          },
          {
            sourcePlayerId: 102,
            name: "Bench Name",
            position: ["GK"],
            number: 1,
            image: null,
            wikiUrl: null,
          },
        ],
      },
    });
    prisma.player.findMany.mockResolvedValue([{ id: 300, name: "Same Name" }]);
    prisma.player.create
      .mockResolvedValueOnce({ id: 301, name: "New Name" })
      .mockResolvedValueOnce({ id: 302, name: "Bench Name" });
    prisma.formation.findFirst.mockResolvedValue(null);
    prisma.formation.create.mockResolvedValue({
      id: 77,
      name: "Shared 4-4-2",
      nodes: [],
      positions: {},
    });

    const { POST } = await import("../src/app/api/formation-shares/[token]/import/route");
    const res = await POST(new Request("http://localhost:3000"), {
      params: Promise.resolve({ token: "abc" }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.formation?.id).toBe(77);
    expect(prisma.player.create).toHaveBeenCalledTimes(2);
    expect(prisma.formation.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.formation.create.mock.calls[0][0];
    expect(createArg.data.positions.lineupOrder).toEqual([300, 301]);
    expect(createArg.data.positions.benchOrder).toEqual([302]);
  });
});
