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
    if (url.startsWith('/api/players')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/rosters')) return Promise.resolve({ ok: true, json: async () => rosters });
    if (url.startsWith('/api/tournaments')) return Promise.resolve({ ok: true, json: async () => tournaments });
    if (url.startsWith('/api/favorites')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

describe('Roster filter UI', () => {
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

  it('keeps roster and position selects available after selecting a roster', async () => {
    global.fetch = mockFetch();
    render(<PlayersPage />);
    await screen.findByText('Apply Filters');
    // two multi-selects: roster and position
    expect(screen.getAllByRole('listbox').length).toBe(2);
    const mainSelect = screen.getAllByRole('listbox')[0] as HTMLSelectElement;
    const option = Array.from(mainSelect.options).find((opt) => opt.value === '1');
    if (option) option.selected = true;
    fireEvent.change(mainSelect);
    await waitFor(() => expect(screen.getAllByRole('listbox').length).toBe(2));
    expect(
      screen.getAllByText('Cup - 2024/01/01-2024/01/10').length
    ).toBeGreaterThan(0);
  });

  it('includes custom player positions in position select', async () => {
    const players = [
      { id: 1, name: 'Sam', position: ['Sweeper'], role: 'player' },
    ];
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
    });
    render(<PlayersPage />);
    await screen.findByText('Apply Filters');
    const posSelect = screen.getAllByRole('listbox')[1] as HTMLSelectElement;
    expect(
      Array.from(posSelect.options).some((opt) => opt.value === 'Sweeper')
    ).toBe(true);
  });
});
