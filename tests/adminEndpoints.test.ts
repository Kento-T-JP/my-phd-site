import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const client = {
    player: {},
    roster: {},
    rosterPlayer: {},
    $transaction: vi.fn(async (fn: any) => fn(client)),
  } as any;
  return {
    __esModule: true,
    default: client,
    updatePlayer: vi.fn(),
    createPlayer: vi.fn(),
    upsertPlayer: vi.fn(),
    upsertTournamentRosterPlayers: vi.fn(),
    upsertTournamentRosterPlayersBySlug: vi.fn(),
    ensureTournamentRoster: vi.fn(),
    addRosterPlayers: vi.fn(),
    syncRosterPlayers: vi.fn(),
    getRosters: vi.fn(),
    getPlayers: vi.fn(),
    getTournamentNames: vi.fn(),
    getTournaments: vi.fn(),
    getRosterTitles: vi.fn(),
  };
});

vi.mock('@/lib/jfa', () => ({
  __esModule: true,
  validateJfaUrl: vi.fn(),
  scrapeJfaPlayers: vi.fn(),
}));

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

let sessionSpy: any;

describe('admin API authorization', () => {
  beforeEach(async () => {
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
  });

  it('blocks unauthenticated from jfa import', async () => {
    const { POST } = await import('../src/app/api/jfa-import/route');
    sessionSpy.mockResolvedValue(null);
    const res = await POST(new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://example.com' }),
    }));
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated from creating player', async () => {
    const { POST } = await import('../src/app/api/players/route');
    sessionSpy.mockResolvedValue(null);
    const form = new FormData();
    form.append('name', 'A');
    form.append('position', 'GK');
    const res = await POST(new Request('http://test', { method: 'POST', body: form }));
    expect(res.status).toBe(401);
  });

});
