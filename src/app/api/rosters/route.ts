import { NextResponse } from 'next/server';
import prisma, { getRosters, ensureTournamentRoster } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') || undefined;
  const rosters = await getRosters(slug || undefined);
  return NextResponse.json(rosters);
}

export async function POST(req: Request) {
  try {
    const { tournament } = await req.json();
    if (!tournament || typeof tournament !== 'string') {
      return NextResponse.json({ error: 'Invalid tournament' }, { status: 400 });
    }
    const roster = await ensureTournamentRoster(tournament);
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
