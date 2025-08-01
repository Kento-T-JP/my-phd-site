import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const client = {
    user: {},
    favoritePlayer: {},
  } as any;
  return {
    __esModule: true,
    default: client,
    getFavoritePlayers: vi.fn(),
    addFavoritePlayer: vi.fn(),
    removeFavoritePlayer: vi.fn(),
  };
});

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let prisma: {
  user: { findUnique: any };
  favoritePlayer: { findMany: any; upsert: any; delete: any };
};
let getFavSpy: ReturnType<typeof vi.fn>;
let addFavSpy: ReturnType<typeof vi.fn>;
let removeFavSpy: ReturnType<typeof vi.fn>;
let sessionSpy: ReturnType<typeof vi.fn>;

describe('favorite players API routes', () => {
  beforeEach(async () => {
    const db = await import('@/lib/db');
    prisma = db.default as any;
    getFavSpy = db.getFavoritePlayers as any;
    addFavSpy = db.addFavoritePlayer as any;
    removeFavSpy = db.removeFavoritePlayer as any;

    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;

    prisma.user.findUnique = vi.fn();
    prisma.favoritePlayer.findMany = vi.fn();
    prisma.favoritePlayer.upsert = vi.fn();
    prisma.favoritePlayer.delete = vi.fn();

    getFavSpy.mockReset();
    addFavSpy.mockReset();
    removeFavSpy.mockReset();
    sessionSpy.mockReset();
  });

  it("GET returns the user's favorites", async () => {
    const { GET } = await import('../src/app/api/favorites/route');
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com' } });
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    getFavSpy.mockResolvedValue([
      { userId: 1, playerId: 2, player: { id: 2, name: 'Fav' } },
    ]);

    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].player.id).toBe(2);
    expect(getFavSpy).toHaveBeenCalledWith(1);
  });

  it('POST adds a new favorite and handles duplicates gracefully', async () => {
    const { POST } = await import('../src/app/api/favorites/route');
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com' } });
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    addFavSpy.mockResolvedValue(undefined);

    const makeReq = () =>
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ playerId: 9 }),
        headers: { 'Content-Type': 'application/json' },
      });

    let res = await POST(makeReq());
    expect(res.status).toBe(201);
    res = await POST(makeReq());
    expect(res.status).toBe(201);
    expect(addFavSpy).toHaveBeenCalledTimes(2);
    expect(addFavSpy).toHaveBeenLastCalledWith(1, 9);
  });

  it('DELETE removes a favorite', async () => {
    const { DELETE } = await import('../src/app/api/favorites/route');
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com' } });
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    removeFavSpy.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request('http://test?playerId=9', { method: 'DELETE' })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(removeFavSpy).toHaveBeenCalledWith(1, 9);
  });
});
