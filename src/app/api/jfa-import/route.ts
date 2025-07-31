import { NextResponse } from 'next/server';
import { upsertPlayer, upsertTournament, upsertRoster, addRosterPlayers } from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !validateJfaUrl(url)) {
      return NextResponse.json({ error: '不正なJFAメンバーURLです' }, { status: 400 });
    }
    const { players, tournament, rosterDate, title } = await scrapeJfaPlayers(url);
    const t = await upsertTournament(tournament);
    const r = await upsertRoster(t.id, rosterDate ?? new Date());
    const rosterEntries = await Promise.all(
      players.map(async (p) => {
        const player = await upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
        });
        return {
          playerId: player.id,
          number: p.number ?? undefined,
          position: p.position,
        } as { playerId: number; number?: number; position?: string[] };
      })
    );
    await addRosterPlayers(r.id, rosterEntries);
    return NextResponse.json({ count: rosterEntries.length, title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'インポートに失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
