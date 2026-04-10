import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    formation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    formationCollaborator: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

describe("formation collaboration API", () => {
  let prisma: any;
  let sessionSpy: any;

  beforeEach(async () => {
    const db = await import("@/lib/db");
    prisma = db.default;
    prisma.user.findUnique.mockReset();
    prisma.user.findMany.mockReset();
    prisma.formation.findUnique.mockReset();
    prisma.formation.findFirst.mockReset();
    prisma.formationCollaborator.deleteMany.mockReset();
    prisma.formationCollaborator.createMany.mockReset();
    prisma.$transaction.mockClear();

    const auth = await import("next-auth/next");
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: "owner@test.com", id: "1" } });
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: "owner@test.com", isAdmin: false });
  });

  it("allows the owner to update collaborators", async () => {
    prisma.formation.findUnique.mockResolvedValue({ id: 5, userId: 1 });
    prisma.user.findMany.mockResolvedValue([{ id: 2, email: "editor@test.com" }]);
    prisma.formationCollaborator.deleteMany.mockResolvedValue({ count: 1 });
    prisma.formationCollaborator.createMany.mockResolvedValue({ count: 1 });
    prisma.formation.findFirst.mockResolvedValue({
      id: 5,
      userId: 1,
      name: "4-3-3",
      positions: {},
      nodes: [],
      user: { id: 1, name: "Owner", email: "owner@test.com" },
      collaborators: [
        { user: { id: 2, name: "Editor", email: "editor@test.com" } },
      ],
      editSessions: [],
    });

    const { PUT } = await import("../src/app/api/formations/[id]/collaborators/route");
    const res = await PUT(
      new Request("http://test/api/formations/5/collaborators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: ["editor@test.com"] }),
      }),
      { params: Promise.resolve({ id: "5" }) }
    );

    expect(res.status).toBe(200);
    expect(prisma.formationCollaborator.deleteMany).toHaveBeenCalledWith({
      where: { formationId: 5 },
    });
    expect(prisma.formationCollaborator.createMany).toHaveBeenCalledWith({
      data: [{ formationId: 5, userId: 2 }],
    });
    const data = await res.json();
    expect(data.collaborators).toEqual([
      { id: 2, name: "Editor", email: "editor@test.com" },
    ]);
  });

  it("rejects collaborator updates from non-owners", async () => {
    prisma.formation.findUnique.mockResolvedValue({ id: 5, userId: 9 });

    const { PUT } = await import("../src/app/api/formations/[id]/collaborators/route");
    const res = await PUT(
      new Request("http://test/api/formations/5/collaborators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: ["editor@test.com"] }),
      }),
      { params: Promise.resolve({ id: "5" }) }
    );

    expect(res.status).toBe(403);
  });
});
