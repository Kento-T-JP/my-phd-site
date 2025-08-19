import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Formation from '@/components/Formation';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const players = [
  { id: 1, name: 'Player 1', position: ['GK'], role: 'player' },
  { id: 2, name: 'Player 2', position: ['DF'], role: 'player' },
  { id: 3, name: 'Player 3', position: ['DF'], role: 'player' },
  { id: 4, name: 'Player 4', position: ['DF'], role: 'player' },
  { id: 5, name: 'Player 5', position: ['DF'], role: 'player' },
  { id: 6, name: 'Player 6', position: ['MF'], role: 'player' },
  { id: 7, name: 'Player 7', position: ['MF'], role: 'player' },
  { id: 8, name: 'Player 8', position: ['MF'], role: 'player' },
  { id: 9, name: 'Player 9', position: ['FW'], role: 'player' },
  { id: 10, name: 'Player 10', position: ['FW'], role: 'player' },
  { id: 11, name: 'Player 11', position: ['FW'], role: 'player' },
  { id: 12, name: 'Player 12', position: ['GK'], role: 'player' },
  { id: 13, name: 'Player 13', position: ['DF'], role: 'player' },
  { id: 14, name: 'Player 14', position: ['MF'], role: 'player' },
  { id: 15, name: 'Player 15', position: ['FW'], role: 'player' },
];

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.startsWith('/api/players')) return Promise.resolve({ ok: true, json: async () => players });
    if (url.startsWith('/api/rosters')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/tournaments')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/favorites')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

describe('Formation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders field and bench players after data load', async () => {
    global.fetch = mockFetch();
    const { container } = render(<Formation />);
    await waitFor(() => {
      const field = container.querySelector('#field');
      const bench = container.querySelector('#bench');
      expect(field && field.querySelectorAll('.player-card').length).toBeGreaterThan(0);
      expect(bench && bench.querySelectorAll('.player-card').length).toBeGreaterThan(0);
    });
  });
});
