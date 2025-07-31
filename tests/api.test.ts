import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const client = { player: {}, roster: {}, rosterPlayer: {}, $transaction: vi.fn(async (fn: any) => fn(client)) } as any;
  return {
    __esModule: true,
    default: client,
    updatePlayer: vi.fn(),
    createPlayer: vi.fn(),
    upsertTournamentRosterPlayers: vi.fn(),
    getRosters: vi.fn(),
    getPlayers: vi.fn(),
  };
});

let prisma: { player: { findUnique: any }; roster: { findUnique: any } };
let updateSpy: ReturnType<typeof vi.fn>;
let createSpy: ReturnType<typeof vi.fn>;
let linkSpy: ReturnType<typeof vi.fn>;
let rosterSpy: ReturnType<typeof vi.fn>;
let playersSpy: ReturnType<typeof vi.fn>;

describe('player API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    updateSpy = mod.updatePlayer as any;
    createSpy = mod.createPlayer as any;
    linkSpy = mod.upsertTournamentRosterPlayers as any;
    rosterSpy = mod.getRosters as any;
    playersSpy = mod.getPlayers as any;
    prisma.player.findUnique = vi.fn();
    prisma.roster.findUnique = vi.fn();
    updateSpy.mockReset();
    createSpy.mockReset();
    linkSpy.mockReset();
    rosterSpy.mockReset();
    playersSpy.mockReset();
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
    createSpy.mockResolvedValue({ id: 1, name: 'C', position: ['GK'] });
    linkSpy.mockResolvedValue({ id: 5, title: 'R', tournamentId: 2 });
    prisma.roster.findUnique.mockResolvedValue({ id: 5, title: 'R', tournament: { id: 2, name: 'T' } });
    const form = new FormData();
    form.append('name', 'C');
    form.append('position', 'GK');
    form.append('tournament', 'T');
    form.append('roster', 'R');
    const req = new Request('http://test', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalled();
    expect(linkSpy).toHaveBeenCalled();
    const data = await res.json();
    expect(data.roster.id).toBe(5);
  });

  it('PUT links player to roster', async () => {
    const { PUT } = await import('../src/app/api/players/[id]/route');
    updateSpy.mockResolvedValue({ id: 1, name: 'D', position: ['DF'] });
    linkSpy.mockResolvedValue({ id: 6, title: 'R2', tournamentId: 3 });
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
    expect(linkSpy).toHaveBeenCalled();
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
    prisma.roster.findUnique = vi.fn();
    rosterSpy.mockReset();
    playersSpy.mockReset();
  });

  it('GET returns rosters', async () => {
    const { GET } = await import('../src/app/api/rosters/route');
    rosterSpy.mockResolvedValue([{ id: 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe(1);
  });

  it('GET players by roster', async () => {
    const { GET } = await import('../src/app/api/rosters/[id]/players/route');
    prisma.roster.findUnique.mockResolvedValue({ id: 1 });
    playersSpy.mockResolvedValue([{ id: 2 }]);
    const res = await GET(new Request('http://test'), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe(2);
  });
});
