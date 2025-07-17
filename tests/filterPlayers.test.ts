import { describe, it, expect } from 'vitest';
import { filterPlayers } from '@/components/Formation';
import type { Player } from '@/types/player';

const players: Player[] = [
  { id: 1, name: 'Alice', position: ['GK'] },
  { id: 2, name: 'Bob', position: ['DF'] },
  { id: 3, name: 'Charlie', position: ['FW'] },
];

describe('filterPlayers', () => {
  it('filters by name substring', () => {
    expect(filterPlayers(players, 'al')).toEqual([players[0]]);
    expect(filterPlayers(players, 'b')).toEqual([players[1]]);
    expect(filterPlayers(players, '')).toEqual(players);
  });
});
