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

describe('player roster input', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows roster input when tournament is provided', () => {
    render(<NewPlayerPage />);
    expect(screen.queryByTestId('roster')).toBeNull();

    fireEvent.change(screen.getByTestId('tournament'), {
      target: { value: 'Cup' },
    });

    const rosterInput = screen.getByTestId('roster');
    expect(rosterInput).toBeTruthy();
    expect(rosterInput).toHaveValue('');
  });
});

