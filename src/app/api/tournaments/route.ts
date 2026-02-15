import { NextResponse } from 'next/server';
import { getTournaments, upsertTournament } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

function normalizeTournamentName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? Number(session.user.id) : undefined;
  const list = await getTournaments(userId);
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    const normalizedName = normalizeTournamentName(name);
    if (!normalizedName) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const tournaments = await getTournaments(userId);
    const duplicate = tournaments.some(
      (t) => normalizeTournamentName(t.name).toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: '同じ名前のトーナメントは作成できません。' },
        { status: 409 }
      );
    }

    const tournament = await upsertTournament(normalizedName);
    return NextResponse.json(tournament);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upsert tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
