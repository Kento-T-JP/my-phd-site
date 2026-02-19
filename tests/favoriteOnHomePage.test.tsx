import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Home from '@/app/home/page';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { email: 'a@test.com' } } }) }));
vi.mock('next-auth/next', () => ({ getServerSession: () => Promise.resolve({ user: { email: 'a@test.com', isAdmin: false } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/url', () => ({ getBaseUrl: () => Promise.resolve('http://localhost:3000') }));
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

  it('allows two-digit input for bench and off bench size', async () => {
    const players = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Player ${i + 1}`,
      position: [i === 0 ? 'GK' : i % 3 === 0 ? 'MF' : i % 2 === 0 ? 'DF' : 'FW'],
      role: 'player',
    }));

    const fetchMock = vi.fn((url: any, opts?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/players?includeRosterLinks=1&includeExtra=0')) {
        return Promise.resolve({ ok: true, json: async () => players });
      }
      if (urlStr.endsWith('/api/players')) {
        return Promise.resolve({ ok: true, json: async () => players });
      }
      if (urlStr.includes('/api/rosters')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (urlStr.includes('/api/favorites')) {
        if (!opts || !opts.method) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      if (urlStr.includes('/api/positions')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (urlStr.includes('/api/tournaments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const ui = await Home({});
    render(ui);

    const benchSizeInput = await screen.findByLabelText('Bench size');
    fireEvent.change(benchSizeInput, { target: { value: '10' } });
    await waitFor(() => {
      expect(benchSizeInput).toHaveValue('10');
    });

    fireEvent.change(benchSizeInput, { target: { value: '0' } });
    await waitFor(() => {
      expect(benchSizeInput).toHaveValue('0');
    });

    const offBenchSizeInput = await screen.findByLabelText('Off bench size');
    fireEvent.change(offBenchSizeInput, { target: { value: '12' } });
    await waitFor(() => {
      expect(offBenchSizeInput).toHaveValue('12');
    });
  });
});
