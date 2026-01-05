import { NextResponse } from 'next/server';
import prisma, { getPlayers } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { unwrapParams } from '@/lib/unwrap';

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
  const session = await getServerSession(authOptions);
  const players = await getPlayers(id, session?.user?.id);
  return NextResponse.json(players);
}
