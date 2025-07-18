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

  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
  });

  it('parses players from sample HTML', async () => {
    const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: fixture });

    const result = await scrapeJfaPlayers('https://www.jfa.jp/samuraiblue/member.html');

    expect(result.title).toBe('AFC Asian Cup 2024');
    expect(result.players).toEqual([
      {
        name: 'John Doe',
        number: 1,
        image: 'https://images.example.com/gk1.jpg',
        position: ['Goalkeepers'],
        tournament: 'AFC Asian Cup 2024',
      },
      {
        name: 'Jane Smith',
        number: 2,
        image: 'https://www.jfa.jp/gk2.jpg',
        position: ['Goalkeepers'],
        tournament: 'AFC Asian Cup 2024',
      },
      {
        name: 'NoNumber Player',
        number: undefined,
        image: 'https://www.jfa.jp/gk3.jpg',
        position: ['Goalkeepers'],
        tournament: 'AFC Asian Cup 2024',
      },
      {
        name: 'Bob Brown',
        number: 3,
        image: 'https://www.jfa.jp/df1.jpg',
        position: ['Defenders'],
        tournament: 'AFC Asian Cup 2024',
      },
    ]);

    spy.mockRestore();
  });
});
