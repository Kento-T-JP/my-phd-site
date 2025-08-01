import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeSlug } from './db';

/** Extract a match date from JFA match detail markup. */
export function extractMatchDate(html: string): Date | undefined {
  const $ = cheerio.load(html);
  const text =
    $('.textarea-match.disp_pc').text() ||
    $('.textarea-match.disp_sp').text() ||
    '';
  const m = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const [, y, mth, d] = m;
    const yyyy = y;
    const mm = mth.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return undefined;
}

export function validateJfaUrl(url: string) {
  return url.startsWith('https://www.jfa.jp/samuraiblue/') && url.endsWith('member.html');
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
  let title = '';
  if (crumbSpans.length) {
    const crumbLinks = $('.outer-block.pankz .pankz-list span a');
    if (crumbLinks.length) {
      const href = $(crumbLinks[crumbLinks.length - 1]).attr('href') || '';
      const m = href.match(/samuraiblue\/(\w+)/);
      if (m) tournamentSlug = m[1];
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
    const m = url.match(/samuraiblue\/(\w+)/);
    if (m) tournamentSlug = m[1];
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
    rosterDate = extractMatchDate(data);
  }
  if (!rosterDate) {
    const m = data.match(/(\d{4}\/\d{2}\/\d{2})/);
    if (m) {
      const [yyyy, mm, dd] = m[1].split('/');
      rosterDate = new Date(`${yyyy}-${mm}-${dd}`);
    }
  }
  title = tournament;
  if (rosterDate) {
    const yyyy = rosterDate.getFullYear();
    const mm = String(rosterDate.getMonth() + 1).padStart(2, '0');
    const dd = String(rosterDate.getDate()).padStart(2, '0');
    title = `${tournament} - ${yyyy}/${mm}/${dd}`;
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
    rosterTitle: title,
  };
}
