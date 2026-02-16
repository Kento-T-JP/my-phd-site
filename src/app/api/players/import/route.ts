import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import prisma, { upsertPlayer } from '@/lib/db';
import { normalizePosition } from '@/lib/positions';
import { resolveSessionUserId } from '@/lib/sessionUser';

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
    const { players } = await req.json();
    if (!Array.isArray(players)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const count = await prisma.$transaction(async (tx) => {
      let inserted = 0;
      for (const p of players) {
        if (!p || typeof p.name !== 'string' || !Array.isArray(p.position)) {
          continue;
        }
        await upsertPlayer(
          {
            name: p.name,
            position: p.position,
            role: 'player',
            extra: p.extra as Record<string, unknown> | undefined,
          },
          undefined,
          tx,
          Number.isFinite(userId) ? userId : undefined,
        );
        inserted += 1;
      }
      return inserted;
    });
    return NextResponse.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '保存に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
