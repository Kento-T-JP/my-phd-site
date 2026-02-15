import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: { user: { findUnique: vi.fn() } },
}));

let prisma: any;

describe("admin authentication", () => {
  beforeEach(async () => {
    const db = await import("@/lib/prisma");
    prisma = db.default;
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValue({ status: "active" });
  });

  it("injects isAdmin into token and session", async () => {
    const mod = await import("../src/lib/authOptions");
    const options = mod.authOptions as any;
    const user = {
      id: "1",
      email: "admin@test.com",
      isAdmin: true,
      status: "active",
    };
    expect(user.isAdmin).toBe(true);

    const token = await options.callbacks.jwt({ token: {}, user, account: { provider: "credentials" } });
    expect(token.isAdmin).toBe(true);

    const session = await options.callbacks.session({ session: { user: {} }, token });
    expect(session.user.isAdmin).toBe(true);
  });
});
