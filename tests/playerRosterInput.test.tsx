import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import NewPlayerPage from '@/app/players/new/page';
import { SessionProvider } from 'next-auth/react';
import * as nextAuthReact from 'next-auth/react';

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

describe('player roster input', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows roster input when tournament is provided', () => {
    vi.spyOn(nextAuthReact, 'getCsrfToken').mockResolvedValue('test-csrf');
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/api/rosters')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as any;
    const session = { user: { id: 1 }, expires: '' } as any;
    render(
      <SessionProvider session={session}>
        <NewPlayerPage />
      </SessionProvider>
    );
    expect(screen.queryByTestId('roster')).toBeNull();

    fireEvent.change(screen.getByTestId('tournament'), {
      target: { value: 'Cup' },
    });

    const rosterInput = screen.getByTestId('roster');
    expect(rosterInput).toBeTruthy();
    expect(rosterInput).toHaveValue('');
  });

  it('submits rosterId when existing roster is selected', async () => {
    vi.spyOn(nextAuthReact, 'getCsrfToken').mockResolvedValue('test-csrf');
    const session = { user: { id: 1 }, expires: '' } as any;
    const fetchMock = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/api/rosters')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 10,
              title: 'Main',
              tournament: { name: 'Cup' },
              date: '2025-01-01T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/api/players') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as any;

    render(
      <SessionProvider session={session}>
        <NewPlayerPage />
      </SessionProvider>
    );

    await waitFor(() => expect(screen.getByTestId('existing-roster')).toBeTruthy());
    fireEvent.change(screen.getByTestId('existing-roster'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Test Player' },
    });
    fireEvent.click(screen.getByLabelText('GK'));
    fireEvent.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, options]) =>
          typeof url === 'string' &&
          url.includes('/api/players') &&
          (options as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      const body = postCall?.[1] && (postCall[1] as RequestInit).body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(form.get('rosterId')).toBe('10');
      expect(form.get('roster')).toBeNull();
    });
  });
});
