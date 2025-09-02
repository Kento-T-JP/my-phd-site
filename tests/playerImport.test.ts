import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as XLSX from 'xlsx';

(globalThis as any).React = React;

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  __esModule: true,
  useSession: () => ({ data: { user: { id: 1 } }, status: 'authenticated' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/db', () => {
  const client = { $transaction: vi.fn() } as any;
  return {
    __esModule: true,
    default: client,
    upsertPlayer: vi.fn(),
  };
});

describe('player import API', () => {
  let sessionSpy: any;
  let prisma: any;
  let upsertSpy: any;

  beforeEach(async () => {
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { id: 1 } });

    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    upsertSpy = mod.upsertPlayer as any;
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    upsertSpy.mockReset();
  });

  it('rejects non-xlsx files', async () => {
    const { POST } = await import('../src/app/api/players/import/route');
    const file = new File([Buffer.from('abc')], 'players.txt');
    (file as any).arrayBuffer = async () => Buffer.from('abc');
    const req = { formData: async () => ({ get: () => file }) } as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('拡張子が.xlsxのファイルのみ対応しています');
  });

  it('rejects oversized files', async () => {
    const { POST } = await import('../src/app/api/players/import/route');
    const bigBuf = Buffer.alloc(2 * 1024 * 1024 + 1);
    const big = new File([bigBuf], 'players.xlsx');
    (big as any).arrayBuffer = async () => bigBuf;
    const req = { formData: async () => ({ get: () => big }) } as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('ファイルサイズが大きすぎます');
  });

  it('parses xlsx and normalizes positions', async () => {
    const { POST } = await import('../src/app/api/players/import/route');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { name: 'A', positions: 'ゴールキーパー, 右サイドバック', note: 'x' },
      { name: '', positions: 'GK', note: 'skip' },
      { name: 'B', positions: '左ウイング CF' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const file = new File([buf], 'players.xlsx');
    (file as any).arrayBuffer = async () => buf;
    const req = { formData: async () => ({ get: () => file }) } as any;
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.players).toEqual([
      { name: 'A', position: ['GK', 'RB'], extra: { note: 'x' } },
      { name: 'B', position: ['LW', 'ST'], extra: { note: '' } },
    ]);
  });

  it('parses Japanese column headers', async () => {
    const { POST } = await import('../src/app/api/players/import/route');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { 名前: 'C', ポジション: 'センターバック 左サイドハーフ', note: 'jp' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const file = new File([buf], 'players.xlsx');
    (file as any).arrayBuffer = async () => buf;
    const req = { formData: async () => ({ get: () => file }) } as any;
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.players).toEqual([
      { name: 'C', position: ['CB', 'LM'], extra: { note: 'jp' } },
    ]);
  });

  it('returns errors for rows missing name or position and shows them on page', async () => {
    const { POST } = await import('../src/app/api/players/import/route');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { name: '', positions: 'GK' },
      { name: 'A', positions: '' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const file = new File([buf], 'players.xlsx');
    (file as any).arrayBuffer = async () => buf;
    const req = { formData: async () => ({ get: () => file }) } as any;
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.players).toEqual([]);
    expect(data.errors).toEqual([
      { row: 0, message: '名前またはポジションが見つかりません' },
      { row: 1, message: '名前またはポジションが見つかりません' },
    ]);

    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => data })
    );
    // @ts-ignore
    global.fetch = fetchMock;
    const mod = await import('@/app/players/import/page');
    const { container } = render(React.createElement(mod.default));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.getByRole('button', { name: 'インポート' });
    fireEvent.click(btn);
    const items = await screen.findAllByText(/名前またはポジションが見つかりません/);
    expect(items.length).toBeGreaterThan(0);
    cleanup();
  });

  it('persists selected players with extras', async () => {
    const { PUT } = await import('../src/app/api/players/import/route');
    const body = {
      players: [
        { name: 'A', position: ['GK'], extra: { note: 'x' } },
        { position: ['CB'] },
      ],
    };
    const req = { json: async () => body } as any;
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      { name: 'A', position: ['GK'], role: 'player', extra: { note: 'x' } },
      undefined,
      prisma,
      1,
    );
    const data = await res.json();
    expect(data.count).toBe(1);
  });
});

