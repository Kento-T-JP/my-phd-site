import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/url', () => ({ getBaseUrl: () => 'http://test' }));

const cookieString = 'session=abc';
const playersSpy = vi.fn();
const sessionSpy = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => ({ toString: () => cookieString }),
  headers: () => new Map(),
}));
vi.mock('@/lib/db', () => ({ __esModule: true, default: {}, getPlayers: playersSpy }));
vi.mock('next-auth/next', () => ({ getServerSession: sessionSpy }));

describe('fetchPlayers auth', () => {
  it('uses cookies so user gets own players', async () => {
    playersSpy.mockResolvedValue([
      { id: 1, name: 'User', position: [], role: 'player' },
    ]);
    sessionSpy.mockResolvedValue({ user: { id: 1 } });

    const fetchStub = vi.fn(async (_url: string, options?: any) => {
      expect(options?.headers?.cookie).toBe(cookieString);
      const { GET } = await import('../src/app/api/players/route');
      return GET(new Request('http://test/api/players'));
    });
    vi.stubGlobal('fetch', fetchStub as any);

    const mod = await import('../src/lib/fetchPlayers');
    const players = await mod.fetchPlayers();

    expect(players).toEqual([
      { id: 1, name: 'User', position: [], role: 'player' },
    ]);
    expect(sessionSpy).toHaveBeenCalled();
    expect(playersSpy).toHaveBeenCalledWith(undefined, 1, {
      includeImage: true,
      includeExtra: true,
      includeRosterLinks: false,
    });

    vi.unstubAllGlobals();
  });
});
