import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    formationShare: {
      deleteMany: vi.fn(),
    },
  },
}));

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  const db = await import("@/lib/db");
  prisma = db.default as any;
  prisma.formationShare.deleteMany.mockReset();
  prisma.formationShare.deleteMany.mockResolvedValue({ count: 3 });
  process.env.CRON_SECRET = "test-secret";
});

describe("cleanup formation shares cron API", () => {
  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("../src/app/api/cron/cleanup-formation-shares/route");
    const req = new Request("http://localhost:3000/api/cron/cleanup-formation-shares");
    const res = await GET(req as any);
    expect(res.status).toBe(401);
    expect(prisma.formationShare.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes expired shares when authorized", async () => {
    const { GET } = await import("../src/app/api/cron/cleanup-formation-shares/route");
    const req = new Request("http://localhost:3000/api/cron/cleanup-formation-shares", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });
    const res = await GET(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deleted).toBe(3);
    expect(prisma.formationShare.deleteMany).toHaveBeenCalledTimes(1);
  });
});
