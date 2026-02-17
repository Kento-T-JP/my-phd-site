import { NextResponse } from 'next/server';
import { getTournamentNames } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';
import { cacheTag } from '@/lib/cacheTags';
import { runWithCache } from '@/lib/cacheRuntime';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean } } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!Number.isFinite(userId)) {
    return NextResponse.json([]);
  }
  const ownerId = userId as number;
  const names = await runWithCache(
    async () => getTournamentNames(q || undefined, ownerId),
    ['api-tournament-names', String(ownerId), q ?? 'all'],
    {
      revalidate: 60,
      tags: [cacheTag.tournamentsNames(ownerId)],
    },
  );
  return NextResponse.json(names);
}
