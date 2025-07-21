import { describe, it, expect } from 'vitest';
import { filterPlayers } from '@/components/Formation';
import type { Player } from '@/types/player';

interface PlayerWithRoster extends Player {
  rosterPlayers?: { rosterId: number }[];
}

const players: PlayerWithRoster[] = [
  { id: 1, name: 'Alice', position: ['GK'], rosterPlayers: [{ rosterId: 1 }] },
  { id: 2, name: 'Bob', position: ['DF'], rosterPlayers: [{ rosterId: 2 }] },
  { id: 3, name: 'Charlie', position: ['FW'], rosterPlayers: [{ rosterId: 1 }] },
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

  it('filters by roster', () => {
    expect(filterPlayers(players, '', 1)).toEqual([players[0], players[2]]);
    expect(filterPlayers(players, 'b', 1)).toEqual([]);
  });

  it('excludes players without roster when filtering', () => {
    expect(filterPlayers(mixedPlayers, '', 1)).toEqual([
      players[0],
      players[2],
    ]);
  });
});
