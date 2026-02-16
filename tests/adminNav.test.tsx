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
    expect(dashboard).toHaveClass('border-cyan-300/60 bg-cyan-300/20 text-cyan-50');
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).not.toHaveClass('border-cyan-300/60');
    expect(users).not.toHaveClass('bg-cyan-300/20');
  });

  it('activates users on /admin/users', () => {
    mockedPath = '/admin/users';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('border-cyan-300/60 bg-cyan-300/20 text-cyan-50');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('border-cyan-300/60');
    expect(dashboard).not.toHaveClass('bg-cyan-300/20');
  });

  it('activates users on /admin/users subpath', () => {
    mockedPath = '/admin/users/123';
    render(<AdminNav />);
    const users = screen.getByRole('link', { name: 'Users' });
    expect(users).toHaveClass('border-cyan-300/60 bg-cyan-300/20 text-cyan-50');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).not.toHaveClass('border-cyan-300/60');
    expect(dashboard).not.toHaveClass('bg-cyan-300/20');
  });
});
