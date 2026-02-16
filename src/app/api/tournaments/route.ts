import { NextResponse } from 'next/server';
import { getTournaments, upsertTournament } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';

function normalizeTournamentName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const { userId } = await resolveSessionUserId(session);
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId, isAdmin } = await resolveSessionUserId(session);
    if (!isAdmin && !Number.isFinite(userId)) {
      return NextResponse.json(
        { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
        { status: 401 }
      );
    }
    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        { error: 'Tournament owner could not be resolved.' },
        { status: 400 }
      );
    }
    const ownerId = userId as number;
    const tournaments = await getTournaments(ownerId);
    const duplicate = tournaments.some(
      (t) => normalizeTournamentName(t.name).toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: '同じ名前のトーナメントは作成できません。' },
        { status: 409 }
      );
    }

    const tournament = await upsertTournament(normalizedName, ownerId);
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
  return NextResponse.json(
    { error: 'Use /api/admin/tournaments for user-scoped tournament deletion.' },
    { status: 400 },
  );

}
