import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

function parseUserId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'shared') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return num;
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { isAdmin?: boolean } } | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const tournamentId = Number(body?.tournamentId);
    const userId = parseUserId(body?.userId);
    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: 'Invalid tournamentId' }, { status: 400 });
    }
    if (userId === undefined) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const rosterWhere =
      userId === null
        ? { tournamentId, userId: null }
        : { tournamentId, userId };

    const rosterIds = (
      await prisma.roster.findMany({ where: rosterWhere, select: { id: true } })
    ).map((r) => r.id);

    if (rosterIds.length === 0) {
      return NextResponse.json({ error: 'No rosters found for this user and tournament' }, { status: 404 });
    }

    const deletedRosterCount = rosterIds.length;

    await prisma.$transaction(async (tx) => {
      await tx.rosterPlayer.deleteMany({ where: { rosterId: { in: rosterIds } } });
      await tx.roster.deleteMany({ where: { id: { in: rosterIds } } });

      const remaining = await tx.roster.count({ where: { tournamentId } });
      if (remaining === 0) {
        await tx.tournament.delete({ where: { id: tournamentId } });
      }
    });

    return NextResponse.json({ ok: true, deletedRosterCount, tournamentId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete tournament rosters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
