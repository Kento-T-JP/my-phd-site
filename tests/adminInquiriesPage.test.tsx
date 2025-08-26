import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, afterEach, expect, vi } from 'vitest';
import AdminInquiriesPage from '@/app/admin/inquiries/page';

// ensure React is available globally for components using the classic JSX runtime
(globalThis as any).React = React;

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { isAdmin: true } }, status: 'authenticated' }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));

const originalFetch = global.fetch;

// jsdom does not implement dialog methods
if (!('showModal' in HTMLDialogElement.prototype)) {
  HTMLDialogElement.prototype.showModal = vi.fn();
}
if (!('close' in HTMLDialogElement.prototype)) {
  HTMLDialogElement.prototype.close = vi.fn();
}

describe('admin inquiries page', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders inquiry ids', async () => {
    const inquiries = [
      {
        id: '123',
        name: 'Alice',
        email: 'alice@example.com',
        isBot: false,
        category: 'General',
        message: 'Hello',
        status: 'received',
        createdAt: new Date().toISOString(),
      },
    ];
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => inquiries }) as any;
    render(<AdminInquiriesPage />);
    await screen.findByText('123');
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bot' })).toBeInTheDocument();
    const firstRow = screen.getAllByRole('row')[1];
    expect(firstRow).toHaveTextContent('123');
    expect(firstRow).toHaveTextContent('No');
  });
});
