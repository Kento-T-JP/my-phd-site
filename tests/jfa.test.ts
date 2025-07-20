import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateJfaUrl, scrapeJfaPlayers } from '../src/lib/jfa';
import axios from "axios";
import fs from "fs";
vi.mock("axios");

describe('validateJfaUrl', () => {
  it('accepts valid Samurai Blue member URLs', () => {
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/member.html')).toBe(true);
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/2024/member.html')).toBe(true);
  });

  it('rejects other URLs', () => {
    expect(validateJfaUrl('https://example.com')).toBe(false);
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/member.htm')).toBe(false);
  });
});

describe('scrapeJfaPlayers', () => {
  const fixture = fs.readFileSync('tests/fixtures/sample_jfa.html', 'utf8');
  const fallbackFixture = fs.readFileSync(
    'tests/fixtures/fallback_jfa.html',
    'utf8'
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses players from sample HTML', async () => {
    const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: fixture });

    const result = await scrapeJfaPlayers('https://www.jfa.jp/samuraiblue/member.html');

    expect(result.title).toBe('AFC Asian Cup 2024');
    expect(result.tournament).toBe('AFC Asian Cup 2024');
    expect(result.rosterDate).toBeUndefined();
    expect(result.players).toEqual([
      {
        name: 'John Doe',
        number: 1,
        image: 'https://images.example.com/gk1.jpg',
        position: ['Goalkeepers'],
      },
      {
        name: 'Jane Smith',
        number: 2,
        image: 'https://www.jfa.jp/gk2.jpg',
        position: ['Goalkeepers'],
      },
      {
        name: 'NoNumber Player',
        number: undefined,
        image: 'https://www.jfa.jp/gk3.jpg',
        position: ['Goalkeepers'],
      },
      {
        name: 'Bob Brown',
        number: 3,
        image: 'https://www.jfa.jp/df1.jpg',
        position: ['Defenders'],
      },
    ]);

    spy.mockRestore();
  });

  it('falls back to previous crumb title with date', async () => {
    const spy = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: fallbackFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/20240720/member.html'
    );

    expect(result.title).toBe('SAMURAI BLUE (2024-07-20)');
    expect(result.tournament).toBe('SAMURAI BLUE');
    expect(result.rosterDate?.toISOString().slice(0,10)).toBe('2024-07-20');
    expect(result.players).toEqual([
      {
        name: 'John Doe',
        number: 1,
        image: 'https://www.jfa.jp/gk1.jpg',
        position: ['Goalkeepers'],
      },
    ]);

    spy.mockRestore();
  });
});
