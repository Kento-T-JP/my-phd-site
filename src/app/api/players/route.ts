import { NextResponse } from 'next/server';
import { getPlayers } from '@/lib/db';

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
}
