import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeSlug } from './db';

/** Extract a match date from JFA match detail markup. */
export interface MatchDateRange {
  start?: Date;
  end?: Date;
}

export function extractMatchDate(html: string): MatchDateRange {
  const $ = cheerio.load(html);
  const text =
    $('.textarea-match.disp_pc').text() ||
    $('.textarea-match.disp_sp').text() ||
    $('.textarea-match').text() ||
    '';
  const matches = [...text.matchAll(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g)];
  let start: Date | undefined;
  let end: Date | undefined;
  if (matches[0]) {
    const [, y, mth, d] = matches[0];
    const mm = mth.padStart(2, '0');
    const dd = d.padStart(2, '0');
    start = new Date(`${y}-${mm}-${dd}`);
  }
  if (matches[1]) {
    const [, y2, mth2, d2] = matches[1];
    const mm2 = mth2.padStart(2, '0');
    const dd2 = d2.padStart(2, '0');
    end = new Date(`${y2}-${mm2}-${dd2}`);
  }
  return { start, end };
}

export function validateJfaUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.jfa.jp') return false;
    const path = parsed.pathname;
    const samuraiPattern = /^\/samuraiblue(?:\/[^/]+)*\/member\.html$/;
    const nationalTeamPattern = /^\/national_team\/[^/]+\/[^/]+\/member\.html$/;
    return samuraiPattern.test(path) || nationalTeamPattern.test(path);
  } catch {
    return false;
  }
}

function extractTournamentSlugFromPath(url: string): string {
  try {
    const parsed = new URL(url, 'https://www.jfa.jp');
    const segs = parsed.pathname.split('/').filter(Boolean);
    if (segs[0] === 'national_team' && segs.length >= 3) {
      return segs[2] ?? '';
    }
    if (segs[0] === 'samuraiblue' && segs.length >= 2) {
      const tail = segs[segs.length - 1];
      if (tail !== 'member.html') {
        return segs[1] ?? '';
      }
      const mids = segs.slice(1, -1);
      if (mids.length === 0) return '';
      // Prefer non-date segment for deep paths like .../final_q_2026/20250320/member.html
      for (let i = mids.length - 1; i >= 0; i--) {
        if (!/^\d{8}$/.test(mids[i])) return mids[i];
      }
      return mids[mids.length - 1] ?? '';
    }
    return '';
  } catch {
    return '';
  }
}

export async function scrapeJfaPlayers(url: string) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const players: { name: string; number?: number; image?: string; position: string[] }[] = [];

  // --- Tournament (breadcrumb) title extraction (robust) ---
  const crumbSpans = $('.outer-block.pankz .pankz-list span');
  function norm(t: string) {
    return t.replace(/\s+/g, ' ').trim();
  }
  let tournament = '';
  let tournamentSlug = '';
  let rosterDate: Date | undefined;
  let rosterEndDate: Date | undefined;
  let title = '';
  if (crumbSpans.length) {
    const crumbLinks = $('.outer-block.pankz .pankz-list span a');
    if (crumbLinks.length) {
      const href = $(crumbLinks[crumbLinks.length - 1]).attr('href') || '';
      tournamentSlug = extractTournamentSlugFromPath(href);
    }
    const texts = crumbSpans
      .map((i, el) => norm($(el).find('a').text() || $(el).text()))
      .get()
      .filter(t => t.length > 0);

    // If last crumb is a generic label like 招集メンバー/スタッフ, use the one before it
    if (texts.length >= 2) {
      const last = texts[texts.length - 1];
      if (/招集|スタッフ/.test(last)) {
        tournament = texts[texts.length - 2];
      }
    }
    // Fallback: if still empty, choose last meaningful crumb (excluding ホーム)
    if (!tournament) {
      for (let i = texts.length - 1; i >= 0; i--) {
        if (texts[i] && texts[i] !== 'ホーム') {
          tournament = texts[i];
          break;
        }
      }
    }
  }
  if (!tournament) {
    tournament = new Date().toISOString().slice(0, 10);
  }
  if (!tournamentSlug) {
    tournamentSlug = extractTournamentSlugFromPath(url);
  }
  if (!tournamentSlug) {
    tournamentSlug = normalizeSlug(tournament);
  }
  const urlDateMatch = url.match(/\/(\d{8})\/?/);
  if (urlDateMatch) {
    const raw = urlDateMatch[1];
    rosterDate = new Date(
      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    );
  }
  if (!rosterDate) {
    const range = extractMatchDate(data);
    rosterDate = range.start;
    rosterEndDate = range.end;
  }
  if (!rosterDate) {
    const m = data.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (m) {
      const [yyyy, mth, d] = m[1].split('/');
      const mm = mth.padStart(2, '0');
      const dd = d.padStart(2, '0');
      rosterDate = new Date(`${yyyy}-${mm}-${dd}`);
    }
  }
  if (!rosterDate) {
    console.warn(
      'Match date not found; please confirm the date manually before saving.'
    );
  }
  title = tournament;
  if (rosterDate) {
    const startStr = [
      rosterDate.getFullYear(),
      String(rosterDate.getMonth() + 1).padStart(2, '0'),
      String(rosterDate.getDate()).padStart(2, '0'),
    ].join('/');
    title = `${tournament} - ${startStr}`;
    if (rosterEndDate) {
      const endStr = [
        rosterEndDate.getFullYear(),
        String(rosterEndDate.getMonth() + 1).padStart(2, '0'),
        String(rosterEndDate.getDate()).padStart(2, '0'),
      ].join('/');
      title = `${tournament} - ${startStr}-${endStr}`;
    }
  }
  // --- end tournament title extraction ---

  $('.section-block').each((_, block) => {
    const posGroup = $(block).find('h4').first().text().trim();
    $(block)
      .find('.competition-member ul li')
      .each((_, li) => {
        const nameLine = $(li).find('.name').text().trim();
        if (!nameLine) return;

        const match = nameLine.match(/^(\d+)\s*[　 ]?(.*)$/);
        const number = match ? parseInt(match[1], 10) : undefined;
        const name = match ? match[2].trim() : nameLine;

        let image = $(li).find('img').attr('src') || '';
        if (image.startsWith('//')) {
          image = 'https:' + image;
        } else if (image.startsWith('/')) {
          image = 'https://www.jfa.jp' + image;
        }

        players.push({
          name,
          number,
          image,
          position: [posGroup],
        });
      });
  });

  return {
    players,
    tournamentName: tournament,
    tournamentSlug,
    rosterDate,
    rosterEndDate,
    rosterTitle: title,
  };
}
