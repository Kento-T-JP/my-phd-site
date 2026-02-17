import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateJfaUrl, scrapeJfaPlayers } from '../src/lib/jfa';
import axios from "axios";
import fs from "fs";
vi.mock("axios");

describe('validateJfaUrl', () => {
  it('accepts valid Samurai Blue member URLs', () => {
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/member.html')).toBe(true);
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/2024/member.html')).toBe(true);
    expect(
      validateJfaUrl(
        'https://www.jfa.jp/samuraiblue/worldcup_2026/final_q_2026/20250320/member.html'
      )
    ).toBe(true);
    expect(
      validateJfaUrl(
        'https://www.jfa.jp/national_team/u23_2026/afc_u23_asiancup_2026/member.html'
      )
    ).toBe(true);
  });

  it('rejects other URLs', () => {
    expect(validateJfaUrl('https://example.com')).toBe(false);
    expect(validateJfaUrl('https://www.jfa.jp/samuraiblue/member.htm')).toBe(false);
    expect(
      validateJfaUrl('https://www.jfa.jp/national_team/u23_2026/member.html')
    ).toBe(false);
  });
});

describe('scrapeJfaPlayers', () => {
  const fixture = fs.readFileSync('tests/fixtures/sample_jfa.html', 'utf8');
  const fallbackFixture = fs.readFileSync(
    'tests/fixtures/fallback_jfa.html',
    'utf8'
  );
  const htmlDateFixture = fs.readFileSync(
    'tests/fixtures/html_date_jfa.html',
    'utf8'
  );
  const matchDateFixture = fs.readFileSync(
    'tests/fixtures/match_date_jfa.html',
    'utf8'
  );
  const textareaOnlyFixture = fs.readFileSync(
    'tests/fixtures/textarea_only_jfa.html',
    'utf8'
  );
  const rangeDateFixture = fs.readFileSync(
    'tests/fixtures/range_date_jfa.html',
    'utf8'
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses players from sample HTML', async () => {
    const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: fixture });

    const result = await scrapeJfaPlayers('https://www.jfa.jp/samuraiblue/member.html');

    expect(result.rosterTitle).toBe('AFC Asian Cup 2024');
    expect(result.tournamentName).toBe('AFC Asian Cup 2024');
    expect(result.tournamentSlug).toBe('2024');
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

    expect(result.rosterTitle).toBe('SAMURAI BLUE - 2024/07/20');
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.tournamentSlug).toBe('20240720');
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

  it('extracts roster date from HTML when URL lacks one', async () => {
    const spy = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: htmlDateFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/event/member.html'
    );

    expect(result.rosterTitle).toBe('SAMURAI BLUE - 2024/09/30');
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.tournamentSlug).toBe('event');
    expect(result.rosterDate?.toISOString().slice(0,10)).toBe('2024-09-30');
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

  it('extracts match date from match info block', async () => {
    const spy = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: matchDateFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/member.html'
    );

    expect(result.rosterTitle).toBe('SAMURAI BLUE - 2025/03/25');
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.tournamentSlug).toBe('event');
    expect(result.rosterDate?.toISOString().slice(0,10)).toBe('2025-03-25');
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

  it('parses match date from textarea-only block', async () => {
    const spy = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: textareaOnlyFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/member.html'
    );

    expect(result.rosterTitle).toBe('SAMURAI BLUE - 2025/06/10');
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.tournamentSlug).toBe('event');
    expect(result.rosterDate?.toISOString().slice(0,10)).toBe('2025-06-10');
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

  it('parses start and end dates from range block', async () => {
    const spy = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: rangeDateFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/member.html'
    );

    expect(result.rosterTitle).toBe(
      'SAMURAI BLUE - 2025/07/07-2025/07/16'
    );
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.tournamentSlug).toBe('event');
    expect(result.rosterDate?.toISOString().slice(0,10)).toBe('2025-07-07');
    expect(result.rosterEndDate?.toISOString().slice(0,10)).toBe('2025-07-16');
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

  it('extracts tournament slug from national team URL format', async () => {
    const inlineFixture = `
      <div class="outer-block pankz">
        <div class="pankz-list">
          <span>ホーム</span>
          <span>U-23日本代表</span>
          <span>招集メンバー</span>
        </div>
      </div>
      <div class="textarea-match disp_pc">2026/04/10 対戦</div>
      <div class="section-block">
        <h4>Goalkeepers</h4>
        <div class="competition-member">
          <ul>
            <li>
              <div class="name">1 John Doe</div>
              <img src="/gk1.jpg" />
            </li>
          </ul>
        </div>
      </div>
    `;
    const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: inlineFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/national_team/u23_2026/afc_u23_asiancup_2026/member.html'
    );

    expect(result.tournamentSlug).toBe('afc_u23_asiancup_2026');
    expect(result.tournamentName).toBe('U-23日本代表');
    expect(result.rosterTitle).toBe('U-23日本代表 - 2026/04/10');
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

  it('extracts samurai blue tournament slug from deep path URL', async () => {
    const inlineFixture = `
      <div class="outer-block pankz">
        <div class="pankz-list">
          <span>ホーム</span>
          <span>SAMURAI BLUE</span>
          <span>招集メンバー/スタッフ</span>
        </div>
      </div>
      <div class="section-block">
        <h4>Goalkeepers</h4>
        <div class="competition-member">
          <ul>
            <li>
              <div class="name">1 John Doe</div>
              <img src="/gk1.jpg" />
            </li>
          </ul>
        </div>
      </div>
    `;
    const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: inlineFixture });

    const result = await scrapeJfaPlayers(
      'https://www.jfa.jp/samuraiblue/worldcup_2026/final_q_2026/20250320/member.html'
    );

    expect(result.tournamentSlug).toBe('final_q_2026');
    expect(result.tournamentName).toBe('SAMURAI BLUE');
    expect(result.rosterDate?.toISOString().slice(0, 10)).toBe('2025-03-20');
    expect(result.rosterTitle).toBe('SAMURAI BLUE - 2025/03/20');

    spy.mockRestore();
  });
});
