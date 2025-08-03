import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import PlayerCard from '@/components/PlayerCard';
import type { Player } from '@/types/player';

const player: Player = {
  id: 1,
  name: 'Test Player',
  position: ['FW'],
  number: 10,
  role: 'player',
};

function setup() {
  const favorites = new Set<number>();
  const toggleFavorite = () => {};
  render(
    <PlayerCard
      player={player}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  );
}

describe('PlayerCard', () => {
  it('toggles flipped state and shows back content', async () => {
    setup();
    const user = userEvent.setup();
    const card = screen.getByTestId('player-card');
    const flipButton = screen.getByRole('button', { name: /show back/i });

    expect(card.getAttribute('data-flipped')).toBe('false');
    const front = screen.getByTestId('front');
    const back = screen.getByTestId('back');
    expect(front).toHaveAttribute('aria-hidden', 'false');
    expect(back).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Test Player')).toBeInTheDocument();
    expect(screen.getByText('背番号: 10')).toBeInTheDocument();

    await user.click(flipButton);

    expect(card.getAttribute('data-flipped')).toBe('true');
    expect(flipButton).toHaveAttribute('aria-label', 'Show front');
    expect(front).toHaveAttribute('aria-hidden', 'true');
    expect(back).toHaveAttribute('aria-hidden', 'false');
  });
});
