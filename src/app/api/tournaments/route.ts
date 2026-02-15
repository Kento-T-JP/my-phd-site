import { NextResponse } from 'next/server';
import prisma, { getTournaments, upsertTournament } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

function normalizeTournamentName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const userId = session?.user?.id ? Number(session.user.id) : undefined;
  const list = await getTournaments(userId);
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    const normalizedName = normalizeTournamentName(name);
    if (!normalizedName) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const tournaments = await getTournaments(userId);
    const duplicate = tournaments.some(
      (t) => normalizeTournamentName(t.name).toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: '同じ名前のトーナメントは作成できません。' },
        { status: 409 }
      );
    }

    const tournament = await upsertTournament(normalizedName);
    return NextResponse.json(tournament);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upsert tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json(
      { error: 'トーナメント削除は管理者のみ実行できます。' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const nameRaw = typeof body?.name === 'string' ? body.name : '';
    const name = normalizeTournamentName(nameRaw);
    if (!name) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true, name: true },
    });
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rosterPlayer.deleteMany({
        where: {
          roster: {
            tournamentId: tournament.id,
          },
        },
      });
      await tx.roster.deleteMany({
        where: { tournamentId: tournament.id },
      });
      await tx.tournament.delete({
        where: { id: tournament.id },
      });
    });

    return NextResponse.json({ ok: true, name: tournament.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
