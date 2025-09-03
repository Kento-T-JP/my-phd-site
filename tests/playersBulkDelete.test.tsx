import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlayersPage from '@/app/players/page';

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

const players = [
  { id: 1, name: 'A', number: 1, position: ['GK'], userId: 1 },
  { id: 2, name: 'B', number: 2, position: ['DF'], userId: 1 },
];

function mockFetch() {
  return vi.fn((url: string, options?: RequestInit) => {
    if (url === '/api/players')
      return Promise.resolve({ ok: true, json: async () => players });
    if (url.startsWith('/api/rosters'))
      return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/tournaments'))
      return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/favorites'))
      return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/players/'))
      return Promise.resolve({ ok: true, json: async () => ({}) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe('Bulk delete players', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('deletes each selected player', async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as any;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PlayersPage />);
    await screen.findByText('A');

    const cb1 = screen.getByLabelText('Select player 1') as HTMLInputElement;
    const cb2 = screen.getByLabelText('Select player 2') as HTMLInputElement;

    fireEvent.click(cb1);
    fireEvent.click(cb2);
    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(true);

    fireEvent.click(screen.getByText('Delete selected'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/2',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
  });
});
