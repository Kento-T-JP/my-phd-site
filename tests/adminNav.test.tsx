import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, afterEach, expect, vi } from 'vitest';

(globalThis as any).React = React;

let mockedPath = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockedPath,
}));

import AdminNav from '@/components/AdminNav';

describe('AdminNav active links', () => {
  afterEach(() => {
    cleanup();
  });

  it('activates only dashboard on /admin', () => {
    mockedPath = '/admin';
    render(<AdminNav />);
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).toHaveClass('font-bold');
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).not.toHaveClass('font-bold');
  });

  it('activates users on /admin/users', () => {
    mockedPath = '/admin/users';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('font-bold');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('font-bold');
  });

  it('activates users on /admin/users subpath', () => {
    mockedPath = '/admin/users/123';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('font-bold');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('font-bold');
  });
});
