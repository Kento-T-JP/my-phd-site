import { NextResponse } from 'next/server';
import prisma, { getPlayers } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { unwrapParams } from '@/lib/unwrap';
import { resolveSessionUserId } from '@/lib/sessionUser';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unwrapped = await unwrapParams(params);
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const roster = await prisma.roster.findUnique({ where: { id } });
  if (!roster) {
    return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
  }
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin) {
    if (Number.isFinite(userId)) {
      if (roster.userId !== null && roster.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (roster.userId !== null) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  const players = await getPlayers(id, userId);
  return NextResponse.json(players);
}
