import { NextResponse } from 'next/server';
import { getTournamentNames } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const names = await getTournamentNames(q || undefined);
  return NextResponse.json(names);
}
