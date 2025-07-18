import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: { player: {} },
  updatePlayer: vi.fn(),
}));

let prisma: { player: { findUnique: any } };
let updateSpy: ReturnType<typeof vi.fn>;

describe('player API routes', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    updateSpy = mod.updatePlayer as any;
    prisma.player.findUnique = vi.fn();
    updateSpy.mockReset();
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
});
