import { NextResponse } from 'next/server';
import prisma, { updatePlayer } from '@/lib/db';
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
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const player = await prisma.player.findUnique({ where: { id: num } });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
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
      typeof numberEntry === 'string' && numberEntry.trim() === ''
        ? undefined
        : numberEntry;

    const parsed = PlayerSchema.safeParse({
      name,
      position: positions,
      number,
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

    const player = await updatePlayer(id, { ...parsed.data, image: imagePath });
    return NextResponse.json(player);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update player';
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
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  return handleUpdate(req, num);
}

export const PATCH = PUT;
