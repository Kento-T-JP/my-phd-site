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
    upsertTournament: vi.fn(),
    upsertRoster: vi.fn(),
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
  rosterPlayer: { findFirst: any; delete: any; create: any; deleteMany: any };
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
let upsertTournamentSpy: ReturnType<typeof vi.fn>;
let upsertRosterSpy: ReturnType<typeof vi.fn>;

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
    upsertTournamentSpy = mod.upsertTournament as any;
    upsertRosterSpy = mod.upsertRoster as any;
    const jfa = await import('@/lib/jfa');
    validateSpy = jfa.validateJfaUrl as any;
    scrapeSpy = jfa.scrapeJfaPlayers as any;
    prisma.player.findUnique = vi.fn();
    prisma.roster.findUnique = vi.fn();
    prisma.rosterPlayer.findFirst = vi.fn();
    prisma.rosterPlayer.delete = vi.fn();
    prisma.rosterPlayer.create = vi.fn();
    prisma.rosterPlayer.deleteMany = vi.fn();
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
    allTSpy.mockResolvedValue([]);
    rTitlesSpy.mockReset();
    upsertTournamentSpy.mockReset();
    upsertRosterSpy.mockReset();
    validateSpy.mockReset();
    scrapeSpy.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true, id: 1 } });
  });

  it('GET players uses session user id', async () => {
    const { GET } = await import('../src/app/api/players/route');
    playersSpy.mockResolvedValue([{ id: 1, name: 'P', position: [], role: 'player' }]);
    const res = await GET(new Request('http://test/api/players'));
    expect(res.status).toBe(200);
    expect(playersSpy).toHaveBeenCalledWith(undefined, 1, {
      includeImage: true,
      includeExtra: true,
    });
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
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1 });
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

  it('POST links player to roster by title', async () => {
    const { POST } = await import('../src/app/api/players/route');
    createSpy.mockResolvedValue({ id: 1, name: 'C', position: ['GK'], role: 'player' });
    upsertTournamentSpy.mockResolvedValue({ id: 2, name: 'T' });
    upsertRosterSpy.mockResolvedValue({ id: 5, title: 'R', tournamentId: 2 });
    prisma.roster.findUnique.mockResolvedValue({ id: 5, title: 'R', tournament: { id: 2, name: 'T' } });
    const form = new FormData();
    form.append('name', 'C');
    form.append('position', 'GK');
    form.append('tournament', 'T');
    form.append('roster', 'R');
    const req = new Request('http://test', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(createSpy.mock.calls[0][0].userId).toBe(1);
    expect(ensureSpy).not.toHaveBeenCalled();
    expect(upsertTournamentSpy).toHaveBeenCalled();
    expect(upsertRosterSpy).toHaveBeenCalledWith(
      2,
      'R',
      1,
      expect.anything(),
      undefined,
    );
    expect(addSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(5);
  });

  it('PUT links player to roster by title', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    updateSpy.mockResolvedValue({ id: 1, name: 'D', position: ['DF'], role: 'player', userId: 1 });
    upsertTournamentSpy.mockResolvedValue({ id: 3, name: 'T2' });
    upsertRosterSpy.mockResolvedValue({ id: 6, title: 'R2', tournamentId: 3 });
    prisma.roster.findUnique.mockResolvedValue({ id: 6, title: 'R2', tournament: { id: 3, name: 'T2' } });
    const form = new FormData();
    form.append('name', 'D');
    form.append('position', 'DF');
    form.append('tournament', 'T2');
    form.append('roster', 'R2');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalled();
    expect(ensureSpy).not.toHaveBeenCalled();
    expect(upsertTournamentSpy).toHaveBeenCalled();
    expect(upsertRosterSpy).toHaveBeenCalledWith(
      3,
      'R2',
      1,
      expect.anything(),
      undefined,
    );
    expect(addSpy).toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(6);
  });

  it('POST uses tournament when roster not selected', async () => {
    const { POST } = await import('../src/app/api/players/route');
    createSpy.mockResolvedValue({ id: 1, name: 'C', position: ['GK'], role: 'player' });
    ensureSpy.mockResolvedValue({ id: 7, tournamentId: 2, title: 'R', date: new Date() });
    prisma.roster.findUnique.mockResolvedValue({ id: 7, tournament: { id: 2, name: 'Cup' }, date: new Date(), title: 'R' });
    const form = new FormData();
    form.append('name', 'C');
    form.append('position', 'GK');
    form.append('tournament', 'Cup');
    const req = new Request('http://test', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(createSpy.mock.calls[0][0].userId).toBe(1);
    expect(ensureSpy).toHaveBeenCalledWith('Cup', 1, expect.anything(), undefined);
    expect(addSpy).toHaveBeenCalled();
    expect(upsertTournamentSpy).not.toHaveBeenCalled();
    expect(upsertRosterSpy).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(7);
  });

  it('PUT uses tournament when roster not selected', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    updateSpy.mockResolvedValue({ id: 1, name: 'D', position: ['DF'], role: 'player', userId: 1 });
    ensureSpy.mockResolvedValue({ id: 8, tournamentId: 3, title: 'R2', date: new Date() });
    prisma.roster.findUnique.mockResolvedValue({ id: 8, tournament: { id: 3, name: 'Cup2' }, date: new Date(), title: 'R2' });
    const form = new FormData();
    form.append('name', 'D');
    form.append('position', 'DF');
    form.append('tournament', 'Cup2');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalled();
    expect(ensureSpy).toHaveBeenCalledWith('Cup2', 1, expect.anything(), undefined);
    expect(addSpy).toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(upsertTournamentSpy).not.toHaveBeenCalled();
    expect(upsertRosterSpy).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(8);
  });

  it('PUT without tournament keeps existing roster links', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    updateSpy.mockResolvedValue({ id: 1, name: 'E', position: ['MF'], role: 'player', userId: 1 });
    const form = new FormData();
    form.append('name', 'E');
    form.append('position', 'MF');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(addSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('PUT removes selected roster links when removeRosterId is provided', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    prisma.player.findUnique.mockResolvedValue({ id: 1, userId: 1 });
    updateSpy.mockResolvedValue({ id: 1, name: 'E', position: ['MF'], role: 'player', userId: 1 });
    const form = new FormData();
    form.append('name', 'E');
    form.append('position', 'MF');
    form.append('removeRosterId', '12');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(prisma.rosterPlayer.deleteMany).toHaveBeenCalledWith({
      where: { playerId: 1, rosterId: { in: [12] } },
    });
  });

  it('PUT creates override for global player', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    sessionSpy.mockResolvedValue({ user: { id: 5, isAdmin: false } });
    prisma.player.findUnique.mockResolvedValue({ id: 2, userId: null, name: 'G', position: ['GK'] });
    const form = new FormData();
    form.append('name', 'G');
    form.append('position', 'GK');
    const req = new Request('http://test', { method: 'PUT', body: form });
    const res = await PUT(req, { params: Promise.resolve({ id: '2' }) });
    expect(res.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
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
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true, id: 1 } });
  });

  it('GET returns rosters', async () => {
    const { GET } = await import('../src/app/api/rosters/route');
    rosterSpy.mockResolvedValue([{ id: 1 }]);
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(rosterSpy).toHaveBeenCalledWith(undefined, 1);
    expect(data[0].id).toBe(1);
  });

  it('GET rosters filtered by slug', async () => {
    const { GET } = await import('../src/app/api/rosters/route');
    rosterSpy.mockResolvedValue([{ id: 5 }]);
    const res = await GET(new Request('http://test?slug=abc'));
    expect(res.status).toBe(200);
    expect(rosterSpy).toHaveBeenCalledWith('abc', 1);
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
    expect(playersSpy).toHaveBeenCalledWith(1, 1);
    expect(data[0].id).toBe(2);
  });
});

describe('lookup API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    tNamesSpy = mod.getTournamentNames as any;
    allTSpy = mod.getTournaments as any;
    rTitlesSpy = mod.getRosterTitles as any;
    upsertTournamentSpy = mod.upsertTournament as any;
    tNamesSpy.mockReset();
    allTSpy.mockReset();
    allTSpy.mockResolvedValue([]);
    rTitlesSpy.mockReset();
    upsertTournamentSpy.mockReset();
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true, id: 1 } });
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
    expect(allTSpy).toHaveBeenCalledWith(1);
    const data = await res.json();
    expect(data[0].slug).toBe('cup');
  });

  it('POST tournaments creates tournament', async () => {
    const { POST } = await import('../src/app/api/tournaments/route');
    upsertTournamentSpy.mockResolvedValue({ id: 4, name: 'New', slug: 'new' });
    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ name: 'New' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertTournamentSpy).toHaveBeenCalledWith('New', 1);
    const data = await res.json();
    expect(data.name).toBe('New');
  });

  it('POST tournaments validates name', async () => {
    const { POST } = await import('../src/app/api/tournaments/route');
    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    expect(upsertTournamentSpy).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('jfa import route', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    linkSlugSpy = mod.upsertTournamentRosterPlayersBySlug as any;
    const jfa = await import('@/lib/jfa');
    validateSpy = jfa.validateJfaUrl as any;
    scrapeSpy = jfa.scrapeJfaPlayers as any;
    linkSlugSpy.mockReset();
    validateSpy.mockReset();
    scrapeSpy.mockReset();
    prisma.player.findMany = vi.fn();
    prisma.player.createMany = vi.fn();
    prisma.player.update = vi.fn();
    prisma.player.updateMany = vi.fn();
    prisma.rosterPlayer = { count: vi.fn() };
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true, id: 1 } });
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
    prisma.player.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 10, name: 'John', number: 1, position: ['GK'] },
      ]);
    prisma.player.createMany.mockResolvedValue({ count: 1 });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.rosterPlayer.count.mockResolvedValue(1);
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
      1,
      date,
      expect.anything(),
    );
  });

  it('links existing players to roster even when skipExisting is true', async () => {
    const { POST } = await import('../src/app/api/jfa-import/route');
    validateSpy.mockReturnValue(true);
    scrapeSpy.mockResolvedValue({
      players: [{ name: 'John', number: 7, image: 'img', position: ['FW'] }],
      tournamentName: 'Cup',
      tournamentSlug: 'cup',
      rosterTitle: 'Cup - 2024/07/21',
      rosterDate: new Date('2024-07-21'),
    });
    prisma.player.findMany
      .mockResolvedValueOnce([{ id: 10, name: 'John', isDeleted: false }])
      .mockResolvedValueOnce([{ id: 10, name: 'John', number: 7, position: ['FW'] }]);
    prisma.player.createMany.mockResolvedValue({ count: 0 });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.rosterPlayer.count.mockResolvedValue(1);
    linkSlugSpy.mockResolvedValue({ id: 6, title: 'Cup - 2024/07/21' });

    const res = await POST(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://www.jfa.jp/samuraiblue/member.html',
          skipExisting: true,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(linkSlugSpy).toHaveBeenCalledWith(
      'cup',
      'Cup',
      'Cup - 2024/07/21',
      [{ playerId: 10, number: 7, position: ['FW'] }],
      1,
      new Date('2024-07-21'),
      expect.anything(),
    );
    const data = await res.json();
    expect(data.skipped).toBe(1);
    expect(data.linked).toBe(1);
  });
});
