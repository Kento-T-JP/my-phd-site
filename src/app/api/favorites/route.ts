import { NextResponse } from 'next/server';
import prisma, {
  getFavoritePlayers,
  addFavoritePlayer,
  removeFavoritePlayer,
} from '@/lib/db';
import type { Player } from '@/types/player';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const favorites = await getFavoritePlayers(user.id);
  return NextResponse.json<Player[]>(favorites);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const id = Number(body?.playerId);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }
  await addFavoritePlayer(user.id, id);
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  let idStr = url.searchParams.get('playerId');
  if (!idStr) {
    try {
      const body = await req.json();
      idStr = body?.playerId;
    } catch {
      idStr = null;
    }
  }
  const id = Number(idStr);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }
  await removeFavoritePlayer(user.id, id);
  return NextResponse.json({ success: true });
}
