import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/db';
import { normalizePosition } from '@/lib/positions';
import { resolveSessionUserId } from '@/lib/sessionUser';
import type { Prisma } from '@prisma/client';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

interface ImportedPlayer {
  name: string;
  position: string[];
  extra: Record<string, unknown>;
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: '拡張子が.xlsxのファイルのみ対応しています' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
    const players: ImportedPlayer[] = [];
    const errors: { row: number; message: string }[] = [];
    rows.forEach((row, i) => {
      const {
        name,
        名前,
        positions,
        position,
        ポジション,
        ...extra
      } = row as Record<string, unknown>;
      const nm =
        typeof name === 'string'
          ? name.trim()
          : typeof 名前 === 'string'
            ? 名前.trim()
            : '';
      const posSrc =
        typeof positions === 'string'
          ? positions
          : typeof position === 'string'
            ? position
            : typeof ポジション === 'string'
              ? ポジション
              : '';
      const pos = Array.from(
        new Set(
          posSrc
            .split(/[ ,\s]+/)
            .map((p) => normalizePosition(p))
            .filter((p) => p.length > 0),
        ),
      );
      if (!nm || pos.length === 0) {
        errors.push({ row: i, message: '名前またはポジションが見つかりません' });
        return;
      }
      players.push({ name: nm, position: pos, extra });
    });
    return NextResponse.json({ players, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解析に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session) {
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
    const { players } = await req.json();
    if (!Array.isArray(players)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
        { status: 401 }
      );
    }
    const ownerId = userId as number;
    const normalized = players
      .filter(
        (p): p is { name: string; position: string[]; extra?: Record<string, unknown> } =>
          Boolean(
            p &&
              typeof p.name === 'string' &&
              p.name.trim() &&
              Array.isArray(p.position) &&
              p.position.length > 0,
          ),
      )
      .map((p) => ({
        name: p.name.trim(),
        position: Array.from(
          new Set(
            p.position
              .map((pos) => normalizePosition(String(pos ?? '')))
              .filter((pos) => pos.length > 0),
          ),
        ),
        extra:
          p.extra && typeof p.extra === 'object'
            ? (p.extra as Prisma.InputJsonValue)
            : undefined,
      }))
      .filter((p) => p.position.length > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ error: '保存対象の選手がありません' }, { status: 400 });
    }

    const names = Array.from(new Set(normalized.map((p) => p.name)));
    const existing = await prisma.player.findMany({
      where: { userId: ownerId, name: { in: names } },
      select: { id: true, name: true, isDeleted: true },
    });
    const existingByName = new Map(existing.map((p) => [p.name, p]));
    const latestByName = new Map(normalized.map((p) => [p.name, p]));

    const toCreate: {
      name: string;
      position: string[];
      isDeleted: false;
      userId: number | null;
      extra?: Prisma.InputJsonValue;
    }[] = [];
    const toUpdate: {
      id: number;
      data: { name: string; position: string[]; isDeleted: false; extra?: Prisma.InputJsonValue };
      restored: boolean;
    }[] = [];

    latestByName.forEach((payload, name) => {
      const before = existingByName.get(name);
      if (!before) {
        toCreate.push({
          name: payload.name,
          position: payload.position,
          isDeleted: false,
          userId: ownerId,
          extra: payload.extra,
        });
        return;
      }
      toUpdate.push({
        id: before.id,
        data: {
          name: payload.name,
          position: payload.position,
          isDeleted: false,
          extra: payload.extra,
        },
        restored: before.isDeleted,
      });
    });

    if (toCreate.length > 0) {
      await prisma.player.createMany({ data: toCreate });
    }
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((p) =>
          prisma.player.update({
            where: { id: p.id },
            data: p.data,
          }),
        ),
      );
    }

    const created = toCreate.length;
    const updated = toUpdate.filter((p) => !p.restored).length;
    const restored = toUpdate.filter((p) => p.restored).length;
    const count = created + updated + restored;
    return NextResponse.json({ count, created, updated, restored, requested: normalized.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '保存に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
