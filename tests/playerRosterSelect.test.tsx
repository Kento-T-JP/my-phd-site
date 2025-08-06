import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import NewPlayerPage from '@/app/players/new/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

vi.mock('@/components/TournamentSelect', () => ({
  default: ({ value, onChange }: any) => (
    <input
      data-testid="tournament"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// ensure React is available for components using old JSX transform
(globalThis as any).React = React;

describe('player roster selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows roster dropdown when only one roster', async () => {
    const fetchMock = vi.fn((url: any) => {
      if (url.toString().includes('/api/rosters')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 1,
              date: '2020-01-01',
              title: 'R',
              tournament: { name: 'Cup' },
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    render(<NewPlayerPage />);

    fireEvent.change(screen.getByTestId('tournament'), {
      target: { value: 'Cup' },
    });

    const rosterSelect = await screen.findByRole('combobox');
    const options = rosterSelect.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0].value).toBe('');
    expect(rosterSelect).toHaveValue('');
  });
});

