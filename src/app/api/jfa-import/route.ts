import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { upsertPlayer } from '@/lib/db';

function validateUrl(url: string) {
  return url.startsWith('https://www.jfa.jp/samuraiblue/') && url.endsWith('member.html');
}

async function scrape(url: string) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  /**
   * JFA のメンバーページ構造
   *
   * <div class="section-block">  ← ポジションのまとまり
   *   <h4>GK</h4>                ← ポジション名
   *   <div class="competition-member">
   *     <ul> <li> ... 選手 ... </li> … </ul>
   *   </div>
   * </div>
   */
  const players: { name: string; number?: number; image?: string; position: string[] }[] = [];

  $('.section-block').each((_, block) => {
    // GK / DF / MF/FW など見出しを取得
    const posGroup = $(block).find('h4').first().text().trim(); // 例: "GK"

    $(block)
      .find('.competition-member ul li')
      .each((_, li) => {
        const nameLine = $(li).find('.name').text().trim();
        if (!nameLine) return; // 空行スキップ

        // "12　早川　友基" のような全角/半角区切りに対応
        const match = nameLine.match(/^(\d+)\s*[　 ]?(.*)$/);
        const number = match ? parseInt(match[1], 10) : undefined;
        const name = match ? match[2].trim() : nameLine;

        // 画像 URL は protocol 相対 or ルート相対なので補完
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
          position: [posGroup], // GK / DF など
        });
      });
  });

  return players;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !validateUrl(url)) {
      return NextResponse.json({ error: 'Invalid JFA member URL' }, { status: 400 });
    }
    const players = await scrape(url);
    let count = 0;
    for (const p of players) {
      await upsertPlayer({
        name: p.name,
        number: p.number,
        image: p.image,
        position: p.position,
      });
      count++;
    }
    return NextResponse.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to import';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
