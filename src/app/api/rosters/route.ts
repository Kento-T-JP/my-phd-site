import { NextResponse } from 'next/server';
import { getRosters } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') || undefined;
  const rosters = await getRosters(slug || undefined);
  return NextResponse.json(rosters);
}
