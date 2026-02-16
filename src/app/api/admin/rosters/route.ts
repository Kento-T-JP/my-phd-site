import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

function parseUserFilter(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return num;
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { isAdmin?: boolean } } | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userFilter = parseUserFilter(searchParams.get('userId'));
  const where =
    userFilter === undefined
      ? undefined
      : { userId: userFilter };

  const rosters = await prisma.roster.findMany({
    where,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      title: true,
      date: true,
      endDate: true,
      userId: true,
      tournamentId: true,
      tournament: { select: { name: true, slug: true } },
      _count: { select: { players: true } },
    },
  });

  return NextResponse.json(rosters);
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { isAdmin?: boolean } } | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rosterId = Number(body?.rosterId);
    if (!Number.isFinite(rosterId)) {
      return NextResponse.json({ error: 'Invalid rosterId' }, { status: 400 });
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { id: true, title: true, tournamentId: true, userId: true },
    });
    if (!roster) {
      return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rosterPlayer.deleteMany({ where: { rosterId: roster.id } });
      await tx.roster.delete({ where: { id: roster.id } });

      const remaining = await tx.roster.count({ where: { tournamentId: roster.tournamentId } });
      if (remaining === 0) {
        await tx.tournament.delete({ where: { id: roster.tournamentId } });
      }
    });

    return NextResponse.json({ ok: true, rosterId: roster.id, title: roster.title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete roster';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
