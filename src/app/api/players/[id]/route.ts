import { NextResponse } from 'next/server';
import prisma, {
  updatePlayer,
  ensureTournamentRoster,
  addRosterPlayers,
  syncRosterPlayers,
} from '@/lib/db';
import { PlayerSchema } from '../route';
import { promises as fs } from 'fs';
import path from 'path';
import React from 'react';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let unwrapped;
  if (
    (React as any).use &&
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher.current
  ) {
    unwrapped = React.use(params as any);
  } else {
    unwrapped = await params;
  }
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
  return NextResponse.json(player);
}

async function handleUpdate(req: Request, id: number) {
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
    const tournamentEntry = form.get('tournament');
    const tournamentName =
      typeof tournamentEntry === 'string' && tournamentEntry.trim() !== ''
        ? tournamentEntry
        : undefined;

    const parsed = PlayerSchema.safeParse({
      name,
      position: positions,
      number,
      tournament: tournamentName,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    let imagePath: string | undefined;
    const file = form.get('image');
    if (file && file instanceof File && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), 'public/uploads/players');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${file.name}`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      imagePath = `/uploads/players/${fileName}`;
    }

    let player;
    let rosterInfo;
    await prisma.$transaction(async (tx) => {
      const prev = await tx.rosterPlayer.findFirst({
        where: { playerId: id },
        orderBy: { rosterId: 'desc' },
      });

      player = await updatePlayer(
        id,
        { name: parsed.data.name, position: parsed.data.position, number: parsed.data.number, image: imagePath },
        undefined,
        tx,
      );
      if (tournamentName) {
        rosterInfo = await ensureTournamentRoster(tournamentName, tx);
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
      rosterInfo = await prisma.roster.findUnique({
        where: { id: rosterInfo.id },
        include: { tournament: true },
      });
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
  let unwrapped;
  if (
    (React as any).use &&
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher.current
  ) {
    unwrapped = React.use(params as any);
  } else {
    unwrapped = await params;
  }
  const num = Number(unwrapped.id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: 'IDが無効です' }, { status: 400 });
  }
  return handleUpdate(req, num);
}

export const PATCH = PUT;
