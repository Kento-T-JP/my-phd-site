import { NextResponse } from 'next/server';
import { getPlayers, createPlayer } from '@/lib/db';

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const player = await createPlayer(data);
    return NextResponse.json(player, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create player';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

