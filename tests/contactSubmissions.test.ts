import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: { contactSubmission: { findMany: vi.fn() } },
}));

vi.mock("next-auth/next", () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let prisma: any;
let sessionSpy: any;

describe("contact submissions API", () => {
  beforeEach(async () => {
    const db = await import("@/lib/db");
    prisma = db.default as any;
    prisma.contactSubmission.findMany.mockReset();

    const auth = await import("next-auth/next");
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("../src/app/api/contact-submissions/route");
    sessionSpy.mockResolvedValue(null);

    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 for non-admin user", async () => {
    const { GET } = await import("../src/app/api/contact-submissions/route");
    sessionSpy.mockResolvedValue({ user: { email: "user@test.com", isAdmin: false } });

    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it("returns submissions for authenticated user", async () => {
    const { GET } = await import("../src/app/api/contact-submissions/route");
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
});
