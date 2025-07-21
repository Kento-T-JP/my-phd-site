import { NextResponse } from 'next/server';
import { getRosters } from '@/lib/db';

export async function GET() {
  const rosters = await getRosters();
  return NextResponse.json(rosters);
}
