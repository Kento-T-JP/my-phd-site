import { NextResponse } from 'next/server';
import prisma, {
  updatePlayer,
  createPlayer,
  ensureTournamentRoster,
  addRosterPlayers,
  syncRosterPlayers,
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
        take: 1,
        include: { roster: { include: { tournament: true } } },
      },
    },
  });
  if (!player) {
    return NextResponse.json({ error: '選手が見つかりません' }, { status: 404 });
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
      let prev;
      if (!overrideUserId) {
        prev = await tx.rosterPlayer.findFirst({
          where: { playerId: id },
          orderBy: { rosterId: 'desc' },
        });
      }

      if (overrideUserId) {
        player = await createPlayer(
          {
            name: parsed.data.name,
            position: parsed.data.position,
            number: parsed.data.number,
            image: imagePath,
            wikiUrl: parsed.data.wikiUrl,
            userId: Number.isFinite(overrideUserId) ? overrideUserId : undefined,
            basePlayerId: id,
            role: 'player',
          },
          undefined,
          tx,
        );
      } else {
        player = await updatePlayer(
          id,
          {
            name: parsed.data.name,
            position: parsed.data.position,
            number: parsed.data.number,
            image: imagePath,
            wikiUrl: parsed.data.wikiUrl,
            role: 'player',
          },
          undefined,
          tx,
        );
      }
      const rosterUserId = overrideUserId ?? player.userId ?? undefined;
      if (rosterId) {
        await addRosterPlayers(
          rosterId,
          [
            {
              playerId: player.id,
              number: parsed.data.number,
              position: parsed.data.position,
            },
          ],
          tx,
        );
        if (prev && prev.rosterId !== rosterId) {
          await syncRosterPlayers(player.id, prev.rosterId, tx);
        }
        rosterInfo = { id: rosterId };
      } else if (rosterTitle && tournamentName) {
        const tournament = await upsertTournament(tournamentName, tx);
        const roster = await upsertRoster(
          tournament.id,
          rosterTitle,
          tx,
          tournamentDate,
          rosterUserId,
        );
        await addRosterPlayers(
          roster.id,
          [
            {
              playerId: player.id,
              number: parsed.data.number,
              position: parsed.data.position,
            },
          ],
          tx,
        );
        if (prev && prev.rosterId !== roster.id) {
          await syncRosterPlayers(player.id, prev.rosterId, tx);
        }
        rosterInfo = roster;
      } else if (tournamentName) {
        rosterInfo = await ensureTournamentRoster(
          tournamentName,
          tx,
          tournamentDate,
          rosterUserId,
        );
        await addRosterPlayers(
          rosterInfo.id,
          [
            {
              playerId: player.id,
              number: parsed.data.number,
              position: parsed.data.position,
            },
          ],
          tx,
        );
        if (prev && prev.rosterId !== rosterInfo.id) {
          await syncRosterPlayers(player.id, prev.rosterId, tx);
        }
      } else if (prev) {
        await syncRosterPlayers(player.id, prev.rosterId, tx);
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
    player.userId &&
    player.userId !== userId &&
    !isAdmin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!player.userId && !isAdmin) {
      return handleUpdate(
        req,
        num,
        userId as number,
    );
  }
  return handleUpdate(req, num);
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
    player.userId &&
    player.userId !== userId &&
    !isAdmin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!player.userId && !isAdmin) {
    await prisma.player.create({
      data: {
        name: player.name,
        position: player.position,
        number: player.number,
        image: player.image,
        wikiUrl: player.wikiUrl,
        userId: userId as number,
        basePlayerId: id,
        isDeleted: true,
      },
    });
  } else {
    await prisma.player.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
  return NextResponse.json({ success: true });
}

export const PATCH = PUT;
