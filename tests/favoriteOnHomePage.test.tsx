import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Home from '@/app/page';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { email: 'a@test.com' } } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/headers', () => ({
  cookies: () => ({ toString: () => '' }),
  headers: () => new Map([['host', 'localhost:3000']]) as any,
}));

// ensure React is available for server components using old JSX transform
(globalThis as any).React = React;

describe('favorites on home page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows favorites and toggles via API', async () => {
    const players = [
      { id: 1, name: 'Player 1', position: ['FW'], role: 'player' },
    ];
    let favState = true;
    const fetchMock = vi.fn((url: any, opts?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/players')) {
        return Promise.resolve({ ok: true, json: async () => players });
      }
      if (urlStr.includes('/api/rosters')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (urlStr.includes('/api/tournaments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (urlStr.includes('/api/favorites')) {
        if (!opts || !opts.method) {
          return Promise.resolve({ ok: true, json: async () => (favState ? players : []) });
        }
        if (opts.method === 'DELETE') favState = false;
        if (opts.method === 'POST') favState = true;
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const ui = await Home({});
    render(ui);

    const favButton = await screen.findByRole('button', {
      name: 'Remove from favorites',
    });
    expect(favButton).toHaveTextContent('★');

    fireEvent.click(favButton);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/favorites',
      expect.objectContaining({ method: 'DELETE' })
    );
    await waitFor(() => {
      expect(favButton).toHaveAttribute('aria-label', 'Add to favorites');
      expect(favButton).toHaveTextContent('☆');
    });

    fireEvent.click(favButton);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/favorites',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

