import { NextResponse } from 'next/server';
import { getRosterTitles } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean } } | null;
  const { userId } = await resolveSessionUserId(session);
  const list = await getRosterTitles(q || undefined, userId);
  return NextResponse.json(list);
}
