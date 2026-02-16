import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 1 } },
    status: 'authenticated',
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const players = [
  { id: 1, name: 'A', number: 1, position: ['GK'], userId: 1 },
  { id: 2, name: 'B', number: 2, position: ['DF'], userId: 1 },
];

function normalizeUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if ('url' in input && typeof input.url === 'string') return input.url;
  return String(input);
}

function mockFetch() {
  return vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = normalizeUrl(input);
    if (url.includes('/api/players?lite=1'))
      return Promise.resolve({ ok: true, json: async () => players });
    if (url.includes('/api/auth/csrf'))
      return Promise.resolve({ ok: true, json: async () => ({ csrfToken: 'test-csrf' }) });
    if (url.includes('/api/players') && options?.method === 'DELETE')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          deleted: 2,
          skipped: 0,
          requested: 2,
          deletedIds: [1, 2],
        }),
      });
    if (url.startsWith('/api/rosters'))
      return Promise.resolve({ ok: true, json: async () => [] });
    if (url.startsWith('/api/favorites'))
      return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe('Bulk delete players', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('keeps bulk delete disabled without selection', async () => {
    const { default: PlayersPage } = await import('@/app/players/page');
    const fetchMock = mockFetch();
    global.fetch = fetchMock as any;

    render(<PlayersPage getCsrfTokenFn={async () => 'test-csrf'} />);
    await screen.findByText('A');

    const deleteButton = screen.getByText('Delete selected') as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) =>
            typeof url === 'string' &&
            url.includes('/api/players') &&
            (options as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(false);
    });
  });

  it('deletes selected players when csrf token is available', async () => {
    const { default: PlayersPage } = await import('@/app/players/page');
    const fetchMock = mockFetch();
    global.fetch = fetchMock as any;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PlayersPage getCsrfTokenFn={async () => 'test-csrf'} />);
    await screen.findByText('A');

    fireEvent.click(screen.getByLabelText('Select player 1'));
    fireEvent.click(screen.getByLabelText('Select player 2'));

    const deleteButton = screen.getByText('Delete selected') as HTMLButtonElement;
    await waitFor(() => expect(deleteButton.disabled).toBe(false));
    fireEvent.click(deleteButton);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        ([url, options]) =>
          url === '/api/players' &&
          (options as RequestInit | undefined)?.method === 'DELETE',
      );
      expect(deleteCall).toBeTruthy();
      const options = deleteCall?.[1] as RequestInit;
      expect(options.body).toBe(JSON.stringify({ ids: [1, 2] }));
      expect((options.headers as Record<string, string>)['X-CSRF-Token']).toBe('test-csrf');
    });
  });
});
