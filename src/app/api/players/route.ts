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
import type { Prisma } from '@prisma/client';
import { cacheTag } from '@/lib/cacheTags';
import { revalidateTagSafe } from '@/lib/cacheRuntime';
import { getFormationScopeOwnerId } from '@/lib/formationAccess';

const shouldProfileApi = () =>
  /^(1|true|on|yes)$/i.test(String(process.env.DEBUG_API_PERF ?? ''));

function buildPerfHeaders(
  wantsPerf: boolean,
  totalMs: number,
  steps: Array<{ step: string; ms: number }>
) {
  if (!wantsPerf) return undefined;
  const headers = new Headers();
  headers.set('x-api-perf-total-ms', String(totalMs));
  headers.set('x-api-perf-steps', JSON.stringify(steps));
  return headers;
}

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
  const wantsPerf = searchParams.get('_perf') === '1';
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  profileStep('parseSearchParams', marker);
  const lite = searchParams.get('lite') === '1';
  const paged = searchParams.get('paged') === '1';
  const includeRosterLinks = searchParams.get('includeRosterLinks') === '1';
  const includeImageParam = searchParams.get('includeImage');
  const includeExtraParam = searchParams.get('includeExtra');
  const includeImage =
    includeImageParam === null ? !lite : includeImageParam === '1';
  const includeExtra =
    includeExtraParam === null ? !lite : includeExtraParam === '1';
  const formationIdParam = Number(searchParams.get('formationId') ?? '');
  const q = (searchParams.get('q') ?? '').trim();
  const rosterIds = (searchParams.get('rosterIds') ?? '')
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  const positions = (searchParams.get('positions') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSizeRaw = Number(searchParams.get('pageSize') ?? '200') || 200;
  const pageSize = Math.min(500, Math.max(20, pageSizeRaw));
  marker = performance.now();
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  profileStep('getServerSession', marker);
  marker = performance.now();
  const { userId } = await resolveSessionUserId(session);
  profileStep('resolveSessionUserId', marker);
  let uid = Number.isFinite(userId) ? Number(userId) : undefined;
  if (uid && Number.isFinite(formationIdParam) && formationIdParam > 0) {
    marker = performance.now();
    const scopedOwnerId = await getFormationScopeOwnerId(formationIdParam, uid);
    profileStep('getFormationScopeOwnerId', marker);
    uid = scopedOwnerId ?? uid;
  }
  if (!uid) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log('[API_PERF] /api/players GET', {
        mode: paged ? 'paged' : 'full',
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json(
      paged ? { players: [], total: 0, page, pageSize } : [],
      { headers: buildPerfHeaders(wantsPerf, totalMs, profileSteps) }
    );
  }

  const where: Prisma.PlayerWhereInput = {
    userId: uid,
    isDeleted: false,
    ...(rosterIds.length > 0
      ? { rosterPlayers: { some: { rosterId: { in: rosterIds } } } }
      : {}),
    ...(positions.length > 0 ? { position: { hasSome: positions } } : {}),
    AND: [
      { NOT: { name: { equals: 'unknown', mode: 'insensitive' as const } } },
      ...(q ? [{ name: { contains: q, mode: 'insensitive' as const } }] : []),
    ],
  };

  if (paged) {
    marker = performance.now();
    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          position: true,
          number: true,
          image: includeImage,
          wikiUrl: true,
          userId: true,
          basePlayerId: true,
          isDeleted: true,
          extra: includeExtra,
          ...(includeRosterLinks
            ? {
                rosterPlayers: {
                  include: {
                    roster: { select: { tournamentId: true } },
                  },
                },
              }
            : {}),
        },
      }),
      prisma.player.count({ where }),
    ]);
    profileStep('prisma.findMany+count', marker);
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log('[API_PERF] /api/players GET', {
        mode: 'paged',
        uid,
        resultCount: players.length,
        total,
        page,
        pageSize,
        includeRosterLinks,
        includeImage,
        includeExtra,
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json({
      players: players.map((p) => ({ ...p, role: 'player' })),
      total,
      page,
      pageSize,
    }, { headers: buildPerfHeaders(wantsPerf, totalMs, profileSteps) });
  }

  marker = performance.now();
  const players = await getPlayers(undefined, uid, {
    includeImage,
    includeExtra,
    includeRosterLinks,
  });
  profileStep('getPlayers', marker);
  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  if (profileEnabled) {
    console.log('[API_PERF] /api/players GET', {
      mode: 'full',
      uid,
      resultCount: players.length,
      includeRosterLinks,
      includeImage,
      includeExtra,
      totalMs,
      steps: profileSteps,
    });
  }
  return NextResponse.json(
    players.filter((p) => p.name.toLowerCase() !== 'unknown'),
    { headers: buildPerfHeaders(wantsPerf, totalMs, profileSteps) }
  );
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
  if (!Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 }
    );
  }
  const ownerId = userId as number;
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
    const rosterIds = Array.from(
      new Set(
        form
          .getAll('rosterId')
          .map((entry) =>
            typeof entry === 'string' && entry.trim() !== '' ? Number(entry) : NaN
          )
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
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
          userId: ownerId,
          role: 'player',
        },
        undefined,
        tx,
      );
      const rosterIdsToLink = new Set<number>(rosterIds);

      if (rosterTitle && tournamentName) {
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
        rosterIdsToLink.add(roster.id);
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
        rosterIdsToLink.add(rosterInfo.id);
      }

      if (rosterIdsToLink.size > 0) {
        await addRosterPlayers(
          Array.from(rosterIdsToLink),
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

      if (!rosterInfo && rosterIds.length > 0) {
        rosterInfo = { id: rosterIds[0] };
      }
    });

    if (rosterInfo) {
      rosterInfo =
        (await prisma.roster.findUnique({
          where: { id: rosterInfo.id },
          include: { tournament: true },
        })) ?? undefined;
    }
    if (rosterIds.length > 0 || rosterTitle || tournamentName) {
      revalidateTagSafe(cacheTag.rosters(ownerId));
      revalidateTagSafe(cacheTag.rostersTitles(ownerId));
      revalidateTagSafe(cacheTag.tournaments(ownerId));
      revalidateTagSafe(cacheTag.tournamentsNames(ownerId));
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
      select: { id: true, userId: true },
    });

    const deletableIds = players
      .filter((player) => {
        if (isAdmin) return true;
        return player.userId != null && player.userId === userId;
      })
      .map((player) => player.id);

    let deleted = 0;
    if (deletableIds.length > 0) {
      const result = await prisma.player.updateMany({
        where: { id: { in: deletableIds } },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      deleted = result.count;
      if (Number.isFinite(userId)) {
        const ownerId = userId as number;
        revalidateTagSafe(cacheTag.rosters(ownerId));
        revalidateTagSafe(cacheTag.rostersTitles(ownerId));
      }
    }

    const skipped = ids.length - deletableIds.length;
    const deletedIds = deletableIds;

    return NextResponse.json({ deleted, skipped, requested: ids.length, deletedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : '選手の削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
