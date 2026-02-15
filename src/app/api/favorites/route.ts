import { NextResponse } from 'next/server';
import prisma, {
  getFavoritePlayers,
  addFavoritePlayer,
  removeFavoritePlayer,
} from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { z } from 'zod';

const FavoritePlayerSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

async function getUser() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const favorites = await getFavoritePlayers(user.id);
  return NextResponse.json(favorites);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = FavoritePlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }
  const { playerId } = parsed.data;
  await addFavoritePlayer(user.id, playerId);
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
      const body: unknown = await req.json();
      const parsed = FavoritePlayerSchema.safeParse(body);
      idStr = parsed.success ? String(parsed.data.playerId) : null;
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
