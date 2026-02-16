import { NextResponse } from 'next/server';
import prisma, {
  updatePlayer,
  ensureTournamentRoster,
  addRosterPlayers,
  upsertTournament,
  upsertRoster,
} from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { PlayerSchema } from '@/lib/schemas/player';
import { promises as fs } from 'fs';
import path from 'path';
import { RosterInfo } from '@/types/roster';
import { unwrapParams } from '@/lib/unwrap';
import { resolveSessionUserId } from '@/lib/sessionUser';

async function savePlayerImage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = path.join(process.cwd(), 'public/uploads/players');
  const fileName = `${Date.now()}-${file.name}`;

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    return `/uploads/players/${fileName}`;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EROFS') {
      throw err;
    }
    const mimeType = file.type || 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const unwrapped = await unwrapParams(params);
  const num = Number(unwrapped.id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: 'IDが無効です' }, { status: 400 });
  }
  const player = await prisma.player.findUnique({
    where: { id: num },
    include: {
      rosterPlayers: {
        orderBy: { rosterId: 'desc' },
        include: { roster: { include: { tournament: true } } },
      },
    },
  });
  if (!player) {
    return NextResponse.json({ error: '選手が見つかりません' }, { status: 404 });
  }
  if (!isAdmin && player.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ ...player, role: 'player' });
}

async function handleUpdate(req: Request, id: number, overrideUserId?: number) {
  try {
    const form = await req.formData();
    const name = form.get('name');
    const positions = form.getAll('position');
    const numberEntry = form.get('number');
    const number =
      numberEntry === null ||
      (typeof numberEntry === 'string' && numberEntry.trim() === '')
        ? undefined
        : numberEntry;
    const wikiUrlEntry = form.get('wikiUrl');
    const wikiUrl =
      typeof wikiUrlEntry === 'string' && wikiUrlEntry.trim() !== ''
        ? wikiUrlEntry
        : undefined;
    const tournamentEntry = form.get('tournament');
    const tournamentName =
      typeof tournamentEntry === 'string' && tournamentEntry.trim() !== ''
        ? tournamentEntry
        : undefined;
    const rosterEntry = form.get('rosterId');
    const rosterId =
      typeof rosterEntry === 'string' && rosterEntry.trim() !== ''
        ? Number(rosterEntry)
        : undefined;
    const rosterTitleEntry = form.get('roster');
    const rosterTitle =
      typeof rosterTitleEntry === 'string' && rosterTitleEntry.trim() !== ''
        ? rosterTitleEntry
        : undefined;
    const dateEntry = form.get('tournamentDate');
    const tournamentDate =
      typeof dateEntry === 'string' && dateEntry.trim() !== ''
        ? new Date(dateEntry)
        : undefined;
    const removeRosterIds = Array.from(
      new Set(
        form
          .getAll('removeRosterId')
          .map((v) => Number(typeof v === 'string' ? v : ''))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );
    const addRosterIds = Array.from(
      new Set(
        form
          .getAll('addRosterId')
          .map((v) => Number(typeof v === 'string' ? v : ''))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    if (rosterTitle && !tournamentName) {
      return NextResponse.json(
        { error: 'Tournament is required when specifying a roster' },
        { status: 400 },
      );
    }

    const parsed = PlayerSchema.safeParse({
      name,
      position: positions,
      number,
      wikiUrl,
      tournament: tournamentName,
      tournamentDate: dateEntry ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    let imagePath: string | undefined;
    const file = form.get('image');
    if (file && file instanceof File && file.size > 0) {
      imagePath = await savePlayerImage(file);
    }

    let player;
    let rosterInfo: RosterInfo | undefined;
    await prisma.$transaction(async (tx) => {
      player = await updatePlayer(
        id,
        {
          name: parsed.data.name,
          position: parsed.data.position,
          number: parsed.data.number,
          image: imagePath,
          wikiUrl: parsed.data.wikiUrl,
          userId: Number.isFinite(overrideUserId) ? overrideUserId : undefined,
          role: 'player',
        },
        undefined,
        tx,
      );
      if (removeRosterIds.length > 0) {
        await tx.rosterPlayer.deleteMany({
          where: {
            playerId: player.id,
            rosterId: { in: removeRosterIds },
          },
        });
      }
      const rosterIdsToAdd = new Set<number>(addRosterIds);
      const rosterUserId = overrideUserId ?? player.userId ?? undefined;
      const ownerId = Number.isFinite(rosterUserId) ? (rosterUserId as number) : undefined;
      if (rosterId) {
        rosterIdsToAdd.add(rosterId);
        rosterInfo = { id: rosterId };
      } else if (rosterTitle && tournamentName) {
        if (!ownerId) {
          throw new Error('Tournament owner could not be resolved.');
        }
        const tournament = await upsertTournament(tournamentName, ownerId, tx);
        const roster = await upsertRoster(
          tournament.id,
          rosterTitle,
          ownerId,
          tx,
          tournamentDate,
        );
        rosterIdsToAdd.add(roster.id);
        rosterInfo = roster;
      } else if (tournamentName) {
        if (!ownerId) {
          throw new Error('Tournament owner could not be resolved.');
        }
        rosterInfo = await ensureTournamentRoster(
          tournamentName,
          ownerId,
          tx,
          tournamentDate,
        );
        rosterIdsToAdd.add(rosterInfo.id);
      }
      if (rosterIdsToAdd.size > 0) {
        await addRosterPlayers(
          Array.from(rosterIdsToAdd),
          [
            {
              playerId: player.id,
              number: parsed.data.number,
              position: parsed.data.position,
            },
          ],
          tx,
        );
      }
    });

    if (rosterInfo) {
      rosterInfo =
        (await prisma.roster.findUnique({
          where: { id: rosterInfo.id },
          include: { tournament: true },
        })) ?? undefined;
    }
    return NextResponse.json({ player, roster: rosterInfo });
  } catch (err) {
    const message = err instanceof Error ? err.message : '選手情報の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const unwrapped = await unwrapParams(params);
  const num = Number(unwrapped.id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: 'IDが無効です' }, { status: 400 });
  }
  const player = await prisma.player.findUnique({ where: { id: num } });
  if (!player) {
    return NextResponse.json({ error: '選手が見つかりません' }, { status: 404 });
  }
  if (
    player.userId !== userId &&
    !isAdmin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return handleUpdate(req, num, Number.isFinite(userId) ? (userId as number) : undefined);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const unwrapped = await unwrapParams(params);
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'IDが無効です' }, { status: 400 });
  }
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: '選手が見つかりません' }, { status: 404 });
  }
  if (
    player.userId !== userId &&
    !isAdmin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.player.update({
    where: { id },
    data: { isDeleted: true },
  });
  return NextResponse.json({ success: true });
}

export const PATCH = PUT;
