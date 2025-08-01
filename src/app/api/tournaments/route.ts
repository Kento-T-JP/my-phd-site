import { NextResponse } from 'next/server';
import { getTournaments } from '@/lib/db';

export async function GET() {
  const list = await getTournaments();
  return NextResponse.json(list);
}
