import { describe, it, expect } from 'vitest';
import { filterPlayers } from '@/components/Formation';
import type { Player } from '@/types/player';

interface PlayerWithRoster extends Player {
  rosterPlayers?: { rosterId: number; roster?: { tournamentId: number } }[];
}

const players: PlayerWithRoster[] = [
  {
    id: 1,
    name: 'Alice',
    position: ['GK'],
    role: 'player',
    rosterPlayers: [{ rosterId: 1, roster: { tournamentId: 10 } }],
  },
  {
    id: 2,
    name: 'Bob',
    position: ['DF'],
    role: 'player',
    rosterPlayers: [{ rosterId: 2, roster: { tournamentId: 20 } }],
  },
  {
    id: 3,
    name: 'Charlie',
    position: ['FW'],
    role: 'player',
    rosterPlayers: [{ rosterId: 1, roster: { tournamentId: 10 } }],
  },
];

const mixedPlayers = [
  ...players,
  { id: 4, name: 'Dave', position: ['MF'], role: 'player' },
];

const playersWithCustom = [
  ...players,
  { id: 4, name: 'Eve', position: ['Sweeper'], role: 'player' },
];

describe('filterPlayers', () => {
  it('filters by name substring', () => {
    expect(filterPlayers(players, { name: 'al' })).toEqual([players[0]]);
    expect(filterPlayers(players, { name: 'b' })).toEqual([players[1]]);
    expect(filterPlayers(players, {})).toEqual(players);
  });

  it('filters by roster', () => {
    expect(filterPlayers(players, { rosterId: 1 })).toEqual([players[0], players[2]]);
    expect(filterPlayers(players, { name: 'b', rosterId: 1 })).toEqual([]);
  });

  it('excludes players without roster when filtering', () => {
    expect(filterPlayers(mixedPlayers, { rosterId: 1 })).toEqual([
      players[0],
      players[2],
    ]);
  });

  it('filters by tournament', () => {
    expect(filterPlayers(players, { tournamentId: 10 })).toEqual([
      players[0],
      players[2],
    ]);
    expect(filterPlayers(players, { name: 'b', tournamentId: 10 })).toEqual([]);
  });

  it('filters by position', () => {
    expect(filterPlayers(players, { position: 'GK' })).toEqual([players[0]]);
    expect(filterPlayers(players, { position: 'FW' })).toEqual([players[2]]);
  });

  it('filters by custom position', () => {
    expect(filterPlayers(playersWithCustom, { position: 'Sweeper' })).toEqual([
      playersWithCustom[3],
    ]);
  });
});
