import { NextResponse } from 'next/server';
import prisma, { getRosters, ensureTournamentRoster } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') || undefined;
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const userId = session?.user?.id ? Number(session.user.id) : undefined;
  const rosters = await getRosters(slug, userId);
  return NextResponse.json(rosters);
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { tournament } = await req.json();
    if (!tournament || typeof tournament !== 'string') {
      return NextResponse.json({ error: 'Invalid tournament' }, { status: 400 });
    }
    const userId = Number(session.user.id);
    const roster = await ensureTournamentRoster(tournament, prisma, undefined, userId);
    const full = await prisma.roster.findUnique({
      where: { id: roster.id },
      include: { tournament: true },
    });
    return NextResponse.json(full ?? roster, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create roster';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
