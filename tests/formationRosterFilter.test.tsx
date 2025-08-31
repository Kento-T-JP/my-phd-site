import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Formation from '@/components/Formation';

let currentUserId: number | null = 1;
const originalFetch = global.fetch;

vi.mock('next-auth/react', () => ({
  useSession: () =>
    currentUserId
      ? { data: { user: { id: currentUserId } }, status: 'authenticated' }
      : { data: null, status: 'unauthenticated' },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const players = [
  {
    id: 1,
    name: 'Alice',
    position: ['FW'],
    rosterPlayers: [{ rosterId: 1, roster: { tournamentId: 1 } }],
    role: 'player',
  },
  {
    id: 2,
    name: 'Bob',
    position: ['FW'],
    rosterPlayers: [{ rosterId: 2, roster: { tournamentId: 1 } }],
    role: 'player',
  },
];

const rosters = [
  {
    id: 1,
    date: '2024-01-01',
    endDate: '2024-01-10',
    tournamentId: 1,
    tournament: { name: 'Cup' },
    title: 'Cup - 2024/01/01-2024/01/10',
  },
  {
    id: 2,
    date: '2024-02-01',
    endDate: '2024-02-10',
    tournamentId: 1,
    tournament: { name: 'Cup' },
    title: 'Cup - 2024/02/01-2024/02/10',
  },
];

const tournaments = [{ id: 1, name: 'Cup', slug: 'cup' }];

function mockFetch() {
  global.fetch = vi.fn((url: string) => {
    if (url.startsWith('/api/players'))
      return Promise.resolve({ ok: true, json: async () => players });
    if (url.startsWith('/api/rosters'))
      return Promise.resolve({ ok: true, json: async () => rosters });
    if (url.startsWith('/api/tournaments'))
      return Promise.resolve({ ok: true, json: async () => tournaments });
    if (url.startsWith('/api/favorites'))
      return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as any;
}

describe('Formation roster filter per user', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
    global.fetch = originalFetch;
  });

  it('loads roster selection based on the logged in user', async () => {
    mockFetch();
    localStorage.setItem('selectedRoster_1', '1');
    localStorage.setItem('selectedRoster_2', '2');

    currentUserId = 1;
    const { rerender } = render(<Formation />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.queryByText('Bob')).toBeNull();

    currentUserId = 2;
    mockFetch();
    rerender(<Formation />);
    await waitFor(() => expect(screen.getByText('Bob')).toBeTruthy());
    expect(screen.queryByText('Alice')).toBeNull();
  });
});
