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
  const players: { name: string; number?: number; image?: string }[] = [];
  $('li').each((_, el) => {
    const name = $(el).find('.nameJa').text().trim();
    if (!name) return;
    const numText = $(el).find('.number').text().trim();
    const number = numText ? parseInt(numText, 10) : undefined;
    let image = $(el).find('img').attr('src');
    if (image && image.startsWith('//')) {
      image = 'https:' + image;
    }
    players.push({ name, number, image });
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
      await upsertPlayer({ name: p.name, number: p.number, image: p.image, position: [] });
      count++;
    }
    return NextResponse.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to import';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
