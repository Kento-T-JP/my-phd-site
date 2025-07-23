import { NextResponse } from 'next/server';
import { upsertPlayer, upsertTournament, upsertRoster, addRosterPlayers } from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !validateJfaUrl(url)) {
      return NextResponse.json({ error: 'Invalid JFA member URL' }, { status: 400 });
    }
    const { players, tournament, rosterDate, title } = await scrapeJfaPlayers(url);
    const t = await upsertTournament(tournament);
    const r = await upsertRoster(t.id, rosterDate ?? new Date());
    const rosterEntries: { playerId: number; number?: number; position?: string[] }[] = [];
    for (const p of players) {
      const player = await upsertPlayer({
        name: p.name,
        number: p.number,
        image: p.image,
        position: p.position,
      });
      rosterEntries.push({
        playerId: player.id,
        number: p.number ?? undefined,
        position: p.position,
      });
    }
    await addRosterPlayers(r.id, rosterEntries);
    return NextResponse.json({ count: rosterEntries.length, title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to import';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
