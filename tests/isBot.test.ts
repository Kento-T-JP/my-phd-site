import { describe, it, expect } from 'vitest';
import isBot from '../src/lib/isBot';

describe('isBot', () => {
  it('detects common bots', () => {
    expect(isBot('Googlebot/1.0')).toBe(true);
    expect(isBot('bingbot/2.0')).toBe(true);
    expect(isBot('Mozilla/5.0')).toBe(false);
    expect(isBot()).toBe(false);
  });
});
