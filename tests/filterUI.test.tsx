import React from 'react';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', async () => {
  const mod = await vi.importActual<any>('next-auth/react');
  return {
    ...mod,
    useSession: () => ({
      data: { user: { id: 1 } },
      status: 'authenticated',
    }),
  };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import RosterTypeahead from '@/components/RosterTypeahead';
import PlayersPage from '@/app/players/page';

const rosters = [
  {
    id: 1,
    date: '2024-01-01',
    endDate: '2024-01-10',
    tournamentId: 1,
    tournament: { name: 'Cup' },
    title: 'Cup - 2024/01/01-2024/01/10',
  },
];
const tournaments = [{ id: 1, name: 'Cup', slug: 'cup' }];

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.startsWith('/api/players')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ players: [], total: 0, page: 1, pageSize: 200 }),
      });
    }
    if (url.startsWith('/api/rosters')) return Promise.resolve({ ok: true, json: async () => rosters });
    if (url.startsWith('/api/tournaments')) return Promise.resolve({ ok: true, json: async () => tournaments });
    if (url.startsWith('/api/favorites')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

describe('Squad filter UI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('formats roster titles in typeahead', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => rosters });
    const { container } = render(
      <RosterTypeahead slug="cup" value="" onChange={() => {}} />
    );
    await waitFor(() => {
      expect(
        container.querySelector('option[value="Cup - 2024/01/01-2024/01/10"]')
      ).toBeTruthy();
    });
  });

  it('keeps squad and position filters available after selecting a squad', async () => {
    global.fetch = mockFetch();
    render(<PlayersPage />);
    await screen.findByText('Apply Filters');
    expect(screen.getByText('Squad (0)')).toBeTruthy();
    expect(screen.getByText('Position (0)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Squad (0) filter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cup - 2024/01/01-2024/01/10' }));
    await waitFor(() => expect(screen.getByText('Squad (1)')).toBeTruthy());
    expect(screen.getByText('Position (0)')).toBeTruthy();
  });

  it('includes custom player positions in position select', async () => {
    const players = [
      { id: 1, name: 'Sam', position: ['Sweeper'], role: 'player' },
    ];
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/players'))
        return Promise.resolve({
          ok: true,
          json: async () => ({ players, total: players.length, page: 1, pageSize: 200 }),
        });
      if (url.startsWith('/api/rosters'))
        return Promise.resolve({ ok: true, json: async () => rosters });
      if (url.startsWith('/api/tournaments'))
        return Promise.resolve({ ok: true, json: async () => tournaments });
      if (url.startsWith('/api/favorites'))
        return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<PlayersPage />);
    await screen.findByText('Apply Filters');
    fireEvent.click(screen.getByRole('button', { name: 'Position (0) filter' }));
    expect(screen.getByRole('checkbox', { name: 'Sweeper' })).toBeTruthy();
  });

  it('applies favorite-only filter on players page', async () => {
    const players = [
      { id: 1, name: 'Fav Player', position: ['FW'], role: 'player' },
      { id: 2, name: 'Normal Player', position: ['DF'], role: 'player' },
    ];
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/players'))
        return Promise.resolve({
          ok: true,
          json: async () => ({ players, total: players.length, page: 1, pageSize: 200 }),
        });
      if (url.startsWith('/api/rosters'))
        return Promise.resolve({ ok: true, json: async () => rosters });
      if (url.startsWith('/api/favorites'))
        return Promise.resolve({ ok: true, json: async () => [{ id: 1 }] });
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<PlayersPage />);
    await screen.findByText('Fav Player');
    await screen.findByText('Normal Player');

    fireEvent.click(screen.getByLabelText('お気に入りのみ'));
    fireEvent.click(screen.getByText('Apply Filters'));

    await waitFor(() => {
      expect(screen.getByText('Fav Player')).toBeTruthy();
      expect(screen.queryByText('Normal Player')).toBeNull();
    });
  });
});
