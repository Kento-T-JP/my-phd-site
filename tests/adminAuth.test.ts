import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: { user: { findUnique: vi.fn() } },
}));

vi.mock("bcrypt", () => ({ compare: vi.fn() }));

let prisma: any;
let compareSpy: any;

describe("admin authentication", () => {
  beforeEach(async () => {
    const db = await import("@/lib/db");
    prisma = db.default;
    prisma.user.findUnique.mockReset();

    const bcrypt = await import("bcrypt");
    compareSpy = bcrypt.compare as any;
    compareSpy.mockReset();
  });

  it("injects isAdmin into token and session", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      hashedPassword: "hashed",
      isAdmin: true,
    });
    compareSpy.mockResolvedValue(true);

    const mod = await import("../src/pages/api/auth/[...nextauth]");
    const options = mod.authOptions as any;

    const provider = options.providers[0];
    const user = await provider.options.authorize({
      email: "admin@test.com",
      password: "pw",
    } as any);
    expect(user.isAdmin).toBe(true);

    const token = await options.callbacks.jwt({ token: {}, user });
    expect(token.isAdmin).toBe(true);

    const session = await options.callbacks.session({ session: { user: {} }, token });
    expect(session.user.isAdmin).toBe(true);
  });
});
