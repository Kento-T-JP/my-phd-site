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
    expect(dashboard).toHaveClass('font-bold bg-blue-600 text-white');
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).not.toHaveClass('font-bold');
    expect(users).not.toHaveClass('bg-blue-600');
    expect(users).not.toHaveClass('text-white');
  });

  it('activates users on /admin/users', () => {
    mockedPath = '/admin/users';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('font-bold bg-blue-600 text-white');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('font-bold');
    expect(dashboard).not.toHaveClass('bg-blue-600');
    expect(dashboard).not.toHaveClass('text-white');
  });

  it('activates users on /admin/users subpath', () => {
    mockedPath = '/admin/users/123';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('font-bold bg-blue-600 text-white');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('font-bold');
    expect(dashboard).not.toHaveClass('bg-blue-600');
    expect(dashboard).not.toHaveClass('text-white');
  });
});
