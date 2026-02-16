import { NextResponse } from 'next/server';
import prisma, {
  getPlayers,
  createPlayer,
  ensureTournamentRoster,
  addRosterPlayers,
  upsertTournament,
  upsertRoster,
} from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { promises as fs } from 'fs';
import path from 'path';
import { RosterInfo } from '@/types/roster';
import { verifyCsrfToken } from '@/lib/csrf';
import { PlayerSchema } from '@/lib/schemas/player';
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lite = searchParams.get('lite') === '1';
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const { userId } = await resolveSessionUserId(session);
  const players = await getPlayers(
    undefined,
    Number.isFinite(userId) ? userId : undefined,
    { includeImage: !lite, includeExtra: !lite },
  );
  const filtered = players.filter(
    (p) => p.name.toLowerCase() !== 'unknown'
  );
  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
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
      player = await createPlayer(
        {
          name: parsed.data.name,
          position: parsed.data.position,
          number: parsed.data.number,
          image: imagePath,
          wikiUrl: parsed.data.wikiUrl,
          userId: Number.isFinite(userId) ? userId : undefined,
          role: 'player',
        },
        undefined,
        tx,
      );
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
        rosterInfo = { id: rosterId };
      } else if (rosterTitle && tournamentName) {
        const tournament = await upsertTournament(tournamentName, tx);
        const roster = await upsertRoster(
          tournament.id,
          rosterTitle,
          tx,
          tournamentDate,
          Number.isFinite(userId) ? userId : undefined,
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
        rosterInfo = roster;
      } else if (tournamentName) {
        rosterInfo = await ensureTournamentRoster(
          tournamentName,
          tx,
          tournamentDate,
          Number.isFinite(userId) ? userId : undefined,
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
      }
    });

    if (rosterInfo) {
      rosterInfo =
        (await prisma.roster.findUnique({
          where: { id: rosterInfo.id },
          include: { tournament: true },
        })) ?? undefined;
    }
    return NextResponse.json({ player, roster: rosterInfo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '選手の登録に失敗しました';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 });
    }

    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        position: true,
        number: true,
        image: true,
        wikiUrl: true,
        userId: true,
      },
    });

    let deleted = 0;
    let skipped = 0;
    const deletedIds: number[] = [];

    await prisma.$transaction(async (tx) => {
      for (const player of players) {
        if (player.userId && player.userId !== userId && !isAdmin) {
          skipped += 1;
          continue;
        }
        if (!player.userId && !isAdmin) {
          await tx.player.upsert({
            where: {
              userId_name: { userId: userId as number, name: player.name },
            },
            update: {
              isDeleted: true,
              basePlayerId: player.id,
              position: player.position,
              number: player.number,
              image: player.image,
              wikiUrl: player.wikiUrl,
            },
            create: {
              name: player.name,
              position: player.position,
              number: player.number,
              image: player.image,
              wikiUrl: player.wikiUrl,
              userId: userId as number,
              basePlayerId: player.id,
              isDeleted: true,
            },
          });
        } else {
          await tx.player.update({
            where: { id: player.id },
            data: { isDeleted: true },
          });
        }
        deleted += 1;
        deletedIds.push(player.id);
      }
    });

    return NextResponse.json({ deleted, skipped, requested: ids.length, deletedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : '選手の削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
