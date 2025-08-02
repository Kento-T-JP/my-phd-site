import { describe, it, expect } from 'vitest';
import { rosterDisplayTitle, type RosterForDisplay } from '../src/lib/format';

describe('rosterDisplayTitle', () => {
  it('returns title when provided', () => {
    const r: RosterForDisplay = {
      id: 1,
      date: '2025-07-07T00:00:00.000Z',
      endDate: '2025-07-16T00:00:00.000Z',
      tournamentId: 1,
      title: 'Custom Title',
      tournament: { name: 'SAMURAI BLUE' },
    };
    expect(rosterDisplayTitle(r)).toBe('Custom Title');
  });

  it('formats range when title missing but endDate present', () => {
    const r: RosterForDisplay = {
      id: 1,
      date: '2025-07-07T00:00:00.000Z',
      endDate: '2025-07-16T00:00:00.000Z',
      tournamentId: 1,
      title: '',
      tournament: { name: 'SAMURAI BLUE' },
    };
    expect(rosterDisplayTitle(r)).toBe(
      'SAMURAI BLUE - 2025/07/07-2025/07/16'
    );
  });
});
