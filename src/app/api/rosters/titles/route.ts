import { NextResponse } from 'next/server';
import { getRosters } from '@/lib/db';

export async function GET() {
  const rosters = await getRosters();
  const list = rosters.map(r => ({
    id: r.id,
    title: `${r.tournament.name} (${r.date.toISOString().slice(0,10)})`
  }));
  return NextResponse.json(list);
}
