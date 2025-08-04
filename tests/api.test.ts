import { describe, it, expect, beforeEach, vi } from 'vitest';

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

let prisma: {
  player: { findUnique: any };
  roster: { findUnique: any };
  rosterPlayer: { findFirst: any; delete: any; create: any };
};
let updateSpy: ReturnType<typeof vi.fn>;
let createSpy: ReturnType<typeof vi.fn>;
let upsertSpy: ReturnType<typeof vi.fn>;
let linkSpy: ReturnType<typeof vi.fn>;
let linkSlugSpy: ReturnType<typeof vi.fn>;
let ensureSpy: ReturnType<typeof vi.fn>;
let addSpy: ReturnType<typeof vi.fn>;
let rosterSpy: ReturnType<typeof vi.fn>;
let playersSpy: ReturnType<typeof vi.fn>;
let tNamesSpy: ReturnType<typeof vi.fn>;
let allTSpy: ReturnType<typeof vi.fn>;
let rTitlesSpy: ReturnType<typeof vi.fn>;
let syncSpy: ReturnType<typeof vi.fn>;
let validateSpy: ReturnType<typeof vi.fn>;
let scrapeSpy: ReturnType<typeof vi.fn>;
let sessionSpy: any;

describe('player API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    updateSpy = mod.updatePlayer as any;
    createSpy = mod.createPlayer as any;
    upsertSpy = mod.upsertPlayer as any;
    linkSpy = mod.upsertTournamentRosterPlayers as any;
    linkSlugSpy = mod.upsertTournamentRosterPlayersBySlug as any;
    ensureSpy = mod.ensureTournamentRoster as any;
    addSpy = mod.addRosterPlayers as any;
    syncSpy = mod.syncRosterPlayers as any;
    rosterSpy = mod.getRosters as any;
    playersSpy = mod.getPlayers as any;
    tNamesSpy = mod.getTournamentNames as any;
    allTSpy = mod.getTournaments as any;
    rTitlesSpy = mod.getRosterTitles as any;
    const jfa = await import('@/lib/jfa');
    validateSpy = jfa.validateJfaUrl as any;
    scrapeSpy = jfa.scrapeJfaPlayers as any;
    prisma.player.findUnique = vi.fn();
    prisma.roster.findUnique = vi.fn();
    prisma.rosterPlayer.findFirst = vi.fn();
    prisma.rosterPlayer.delete = vi.fn();
    prisma.rosterPlayer.create = vi.fn();
    updateSpy.mockReset();
    createSpy.mockReset();
    upsertSpy.mockReset();
    linkSpy.mockReset();
    linkSlugSpy.mockReset();
    ensureSpy.mockReset();
    addSpy.mockReset();
    syncSpy.mockReset();
    rosterSpy.mockReset();
    playersSpy.mockReset();
    tNamesSpy.mockReset();
    allTSpy.mockReset();
    rTitlesSpy.mockReset();
    validateSpy.mockReset();
    scrapeSpy.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });
  });

  it('GET returns a player', async () => {
    const { GET } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue({ id: 1, name: 'A', position: ['GK'] });
    const res = await GET(new Request('http://test'), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('A');
  });

  it('GET 404 when missing', async () => {
    const { GET } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://test'), {
      params: Promise.resolve({ id: '2' }),
    });
    expect(res.status).toBe(404);
  });

  it('PUT returns 400 on update error', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    updateSpy.mockImplementation(() => { throw new Error('duplicate'); });
    const form = new FormData();
    form.append('name', 'B');
    form.append('position', 'GK');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST links player to roster', async () => {
    const { POST } = await import('../src/app/api/players/route');
    createSpy.mockResolvedValue({ id: 1, name: 'C', position: ['GK'], role: 'player' });
    prisma.roster.findUnique.mockResolvedValue({ id: 5, title: 'R', tournament: { id: 2, name: 'T' } });
    const form = new FormData();
    form.append('name', 'C');
    form.append('position', 'GK');
    form.append('rosterId', '5');
    const req = new Request('http://test', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalled();
    expect(ensureSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(5);
  });

  it('PUT links player to roster', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    updateSpy.mockResolvedValue({ id: 1, name: 'D', position: ['DF'], role: 'player' });
    prisma.roster.findUnique.mockResolvedValue({ id: 6, title: 'R2', tournament: { id: 3, name: 'T2' } });
    const form = new FormData();
    form.append('name', 'D');
    form.append('position', 'DF');
    form.append('rosterId', '6');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalled();
    expect(ensureSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(6);
  });
});

describe('roster API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    rosterSpy = mod.getRosters as any;
    playersSpy = mod.getPlayers as any;
    tNamesSpy = mod.getTournamentNames as any;
    allTSpy = mod.getTournaments as any;
    rTitlesSpy = mod.getRosterTitles as any;
    prisma.roster.findUnique = vi.fn();
    rosterSpy.mockReset();
    playersSpy.mockReset();
    tNamesSpy.mockReset();
    allTSpy.mockReset();
    rTitlesSpy.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });
  });

  it('GET returns rosters', async () => {
    const { GET } = await import('../src/app/api/rosters/route');
    rosterSpy.mockResolvedValue([{ id: 1 }]);
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(rosterSpy).toHaveBeenCalledWith(undefined);
    expect(data[0].id).toBe(1);
  });

  it('GET rosters filtered by slug', async () => {
    const { GET } = await import('../src/app/api/rosters/route');
    rosterSpy.mockResolvedValue([{ id: 5 }]);
    const res = await GET(new Request('http://test?slug=abc'));
    expect(res.status).toBe(200);
    expect(rosterSpy).toHaveBeenCalledWith('abc');
    const data = await res.json();
    expect(data[0].id).toBe(5);
  });

  it('POST creates roster', async () => {
    const { POST } = await import('../src/app/api/rosters/route');
    ensureSpy.mockResolvedValue({ id: 10, tournamentId: 8, title: 'New', date: new Date() });
    prisma.roster.findUnique.mockResolvedValue({ id: 10, tournament: { id: 8, name: 'Cup' }, date: new Date(), title: 'New' });
    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({ tournament: 'Cup' }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(ensureSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data.id).toBe(10);
  });

  it('GET players by roster', async () => {
    const { GET } = await import('../src/app/api/rosters/[id]/players/route');
    prisma.roster.findUnique.mockResolvedValue({ id: 1 });
    playersSpy.mockResolvedValue([{ id: 2, name: 'P', position: [], role: 'player' }]);
    const res = await GET(new Request('http://test'), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe(2);
  });
});

describe('lookup API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    tNamesSpy = mod.getTournamentNames as any;
    allTSpy = mod.getTournaments as any;
    rTitlesSpy = mod.getRosterTitles as any;
    tNamesSpy.mockReset();
    allTSpy.mockReset();
    rTitlesSpy.mockReset();
  });

  it('GET tournament names', async () => {
    const { GET } = await import('../src/app/api/tournaments/names/route');
    tNamesSpy.mockResolvedValue([{ id: 1, name: 'T' }]);
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].name).toBe('T');
  });

  it('GET roster titles', async () => {
    const { GET } = await import('../src/app/api/rosters/titles/route');
    rTitlesSpy.mockResolvedValue([{ id: 2, title: 'R' }]);
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].title).toBe('R');
  });

  it('GET tournaments', async () => {
    const { GET } = await import('../src/app/api/tournaments/route');
    allTSpy.mockResolvedValue([{ id: 3, name: 'Cup', slug: 'cup' }]);
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    expect(allTSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data[0].slug).toBe('cup');
  });
});

describe('jfa import route', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    upsertSpy = mod.upsertPlayer as any;
    linkSlugSpy = mod.upsertTournamentRosterPlayersBySlug as any;
    const jfa = await import('@/lib/jfa');
    validateSpy = jfa.validateJfaUrl as any;
    scrapeSpy = jfa.scrapeJfaPlayers as any;
    upsertSpy.mockReset();
    linkSlugSpy.mockReset();
    validateSpy.mockReset();
    scrapeSpy.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });
  });

  it('passes rosterDate through to roster creation', async () => {
    const { POST } = await import('../src/app/api/jfa-import/route');
    const date = new Date('2024-07-20');
    validateSpy.mockReturnValue(true);
    scrapeSpy.mockResolvedValue({
      players: [
        { name: 'John', number: 1, image: 'img', position: ['GK'] },
      ],
      tournamentName: 'Cup',
      tournamentSlug: 'cup',
      rosterTitle: 'Cup - 2024/07/20',
      rosterDate: date,
    });
    upsertSpy.mockResolvedValue({ id: 10 });
    linkSlugSpy.mockResolvedValue({ id: 5, title: 'Cup - 2024/07/20', date });

    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.jfa.jp/samuraiblue/member.html' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(linkSlugSpy).toHaveBeenCalledWith(
      'cup',
      'Cup',
      'Cup - 2024/07/20',
      [{ playerId: 10, number: 1, position: ['GK'] }],
      date,
      expect.anything(),
    );
  });
});
