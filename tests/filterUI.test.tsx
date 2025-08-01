import React from 'react';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RosterTypeahead from '@/components/RosterTypeahead';
import PlayersPage from '@/app/players/page';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const rosters = [
  { id: 1, date: '2024-01-01', tournamentId: 1, tournament: { name: 'Cup' }, title: 'Old' },
  { id: 2, date: '2024-02-01', tournamentId: 1, tournament: { name: 'Cup' }, title: 'Old2' },
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
      expect(container.querySelector('option[value="Cup - 2024/01/01"]')).toBeTruthy();
    });
  });

  it('shows secondary roster select when tournament has multiple rosters', async () => {
    global.fetch = mockFetch();
    render(<PlayersPage />);
    await screen.findByText('Apply Filters');
    // two selects initially (filter and position)
    expect(screen.getAllByRole('combobox').length).toBe(2);
    const mainSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(mainSelect, { target: { value: 't:1' } });
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(3));
    expect(screen.getAllByText('Cup - 2024/01/01').length).toBeGreaterThan(0);
  });
});
