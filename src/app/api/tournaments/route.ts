import { NextResponse } from 'next/server';
import { getTournaments, upsertTournament } from '@/lib/db';

export async function GET() {
  const list = await getTournaments();
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
