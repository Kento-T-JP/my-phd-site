import { NextResponse } from 'next/server';
import { upsertPlayer } from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !validateJfaUrl(url)) {
      return NextResponse.json({ error: 'Invalid JFA member URL' }, { status: 400 });
    }
    const { players, title } = await scrapeJfaPlayers(url);
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
    return NextResponse.json({ count, title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to import';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
