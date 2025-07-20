import { describe, it, expect } from 'vitest';
import { filterPlayers } from '@/components/Formation';
import type { Player } from '@/types/player';

interface PlayerWithTournament extends Player {
  tournament?: string;
}

const players: PlayerWithTournament[] = [
  { id: 1, name: 'Alice', position: ['GK'], tournament: 'CupA' },
  { id: 2, name: 'Bob', position: ['DF'], tournament: 'CupB' },
  { id: 3, name: 'Charlie', position: ['FW'], tournament: 'CupA' },
];

const mixedPlayers = [
  ...players,
  { id: 4, name: 'Dave', position: ['MF'] },
];

describe('filterPlayers', () => {
  it('filters by name substring', () => {
    expect(filterPlayers(players, 'al')).toEqual([players[0]]);
    expect(filterPlayers(players, 'b')).toEqual([players[1]]);
    expect(filterPlayers(players, '')).toEqual(players);
  });

  it('filters by tournament', () => {
    expect(filterPlayers(players, '', 'CupA')).toEqual([players[0], players[2]]);
    expect(filterPlayers(players, 'b', 'CupA')).toEqual([]);
  });

  it('excludes players without tournament when filtering', () => {
    expect(filterPlayers(mixedPlayers, '', 'CupA')).toEqual([
      players[0],
      players[2],
    ]);
  });
});
