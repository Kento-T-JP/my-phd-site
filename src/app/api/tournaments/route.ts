import { NextResponse } from 'next/server';
import { getTournaments, upsertTournament } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

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
    const tournament = await upsertTournament(name);
    return NextResponse.json(tournament);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upsert tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
