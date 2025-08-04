import { describe, it, beforeEach, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    contactSubmission: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("next-auth/next", () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let prisma: any;
let sessionSpy: any;

describe("admin inquiries API", () => {
  beforeEach(async () => {
    const db = await import("@/lib/db");
    prisma = db.default as any;
    prisma.contactSubmission.findMany.mockReset();
    prisma.contactSubmission.update.mockReset();
    prisma.contactSubmission.delete.mockReset();

    const auth = await import("next-auth/next");
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: "a@test.com", isAdmin: true } });
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("../src/app/api/admin/inquiries/route");
    sessionSpy.mockResolvedValue(null);
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 for non-admin user", async () => {
    const { GET } = await import("../src/app/api/admin/inquiries/route");
    sessionSpy.mockResolvedValue({ user: { email: "user@test.com", isAdmin: false } });
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it("returns inquiries for authenticated user", async () => {
    const { GET } = await import("../src/app/api/admin/inquiries/route");
    sessionSpy.mockResolvedValue({ user: { email: "a@test.com", isAdmin: true } });
    const fake = [
      {
        id: "1",
        name: "Bob",
        email: "bob@example.com",
        category: "General",
        message: "Hello",
        status: "received",
        createdAt: new Date().toISOString(),
      },
    ];
    prisma.contactSubmission.findMany.mockResolvedValue(fake);
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(200);
    expect(prisma.contactSubmission.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        category: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
    const data = await res.json();
    expect(data).toEqual(fake);
  });

  it("marks an inquiry as handled", async () => {
    const { PATCH } = await import("../src/app/api/admin/inquiries/[id]/route");
    const fake = {
      id: "1",
      name: "Bob",
      email: "bob@example.com",
      category: "General",
      message: "Hello",
      status: "handled",
      createdAt: new Date().toISOString(),
    };
    prisma.contactSubmission.update.mockResolvedValue(fake);
    const res = await PATCH(new Request("http://test", { method: "PATCH" }), {
      params: Promise.resolve({ id: "1" }),
    } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("handled");
    expect(prisma.contactSubmission.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { status: "handled" },
      select: {
        id: true,
        name: true,
        email: true,
        category: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it("deletes an inquiry", async () => {
    const { DELETE } = await import("../src/app/api/admin/inquiries/[id]/route");
    prisma.contactSubmission.delete.mockResolvedValue({ id: "1" });
    const res = await DELETE(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ id: "1" }),
    } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(prisma.contactSubmission.delete).toHaveBeenCalledWith({
      where: { id: "1" },
    });
  });
});
