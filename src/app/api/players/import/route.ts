import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import prisma, { upsertPlayer } from '@/lib/db';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

interface ImportedPlayer {
  name: string;
  position: string[];
  extra: Record<string, unknown>;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
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
    const players: ImportedPlayer[] = rows
      .map((row) => {
        const { name, positions, position, ...extra } = row as Record<string, unknown>;
        const nm = typeof name === 'string' ? name.trim() : '';
        const posSrc = typeof positions === 'string' ? positions : (typeof position === 'string' ? position : '');
        const pos = posSrc
          .split(/[,\s]+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        return { name: nm, position: pos, extra };
      })
      .filter((p) => p.name);
    return NextResponse.json({ players });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解析に失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

