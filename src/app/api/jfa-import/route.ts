import { NextResponse } from 'next/server';
import prisma, {
  upsertPlayer,
  upsertTournamentRosterPlayersBySlug,
} from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rawId = session.user?.id;
  const userId = rawId === undefined ? undefined : Number(rawId);
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !validateJfaUrl(url)) {
      return NextResponse.json({ error: '不正なJFAメンバーURLです' }, { status: 400 });
    }
    const {
      players,
      tournamentName,
      tournamentSlug,
      rosterTitle,
      rosterDate,
    } = await scrapeJfaPlayers(url);
    const rosterEntries = await Promise.all(
      players.map(async (p) => {
        const player = await upsertPlayer({
          name: p.name,
          number: p.number,
          image: p.image,
          position: p.position,
          role: 'player',
        });
        return {
          playerId: player.id,
          number: p.number ?? undefined,
          position: p.position,
        } as { playerId: number; number?: number; position?: string[] };
      })
    );

      const roster = await prisma.$transaction(async (tx) => {
        return upsertTournamentRosterPlayersBySlug(
          tournamentSlug,
          tournamentName,
          rosterTitle,
          rosterEntries,
          rosterDate,
          tx,
          Number.isFinite(userId) ? userId : undefined,
        );
      });

    return NextResponse.json({ count: rosterEntries.length, title: roster.title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'インポートに失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
