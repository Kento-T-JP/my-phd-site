import { describe, it, expect } from 'vitest';
import { normalizePosition, positionToJapanese } from '../src/lib/positions';

describe('positions utility', () => {
  it('normalizes Japanese names to English codes', () => {
    expect(normalizePosition('ゴールキーパー')).toBe('GK');
    expect(normalizePosition('センターバック')).toBe('CB');
    expect(normalizePosition('右ウイング')).toBe('RW');
    expect(normalizePosition('ボランチ')).toBe('DMF');
  });

  it('normalizes full-width and english names', () => {
    expect(normalizePosition('ＧＫ')).toBe('GK');
    expect(normalizePosition('left wing')).toBe('LW');
  });

  it('maps back to Japanese', () => {
    expect(positionToJapanese('GK')).toBe('ゴールキーパー');
    expect(positionToJapanese('DMF')).toBe('守備的ミッドフィールダー');
  });
});

