import { NextResponse } from 'next/server';
import prisma, {
  getPlayers,
  createPlayer,
  ensureTournamentRoster,
  addRosterPlayers,
} from '@/lib/db';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

export const PlayerSchema = z.object({
  name: z.string().min(1, { message: "名前は必須です" }),
  position: z.array(z.string()).min(1, { message: "ポジションを1つ以上選択してください" }),
  number: z.coerce
    .number()
    .int({ message: "背番号は整数で入力してください" })
    .min(1, { message: "背番号は1以上で入力してください" })
    .max(99, { message: "背番号は99以下で入力してください" })
    .optional(),
  wikiUrl: z.string().url().optional(),
  tournament: z.string().optional(),
  tournamentDate: z.string().optional(),
});

export async function GET() {
  const players = await getPlayers();
  const filtered = players.filter(
    (p) => p.name.toLowerCase() !== 'unknown'
  );
  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  try {
  const form = await req.formData();
  const name = form.get("name");
  const positions = form.getAll("position");
  const numberEntry = form.get("number");
  const number =
    numberEntry === null ||
    (typeof numberEntry === "string" && numberEntry.trim() === "")
      ? undefined
      : numberEntry;
  const wikiUrlEntry = form.get("wikiUrl");
  const wikiUrl =
    typeof wikiUrlEntry === "string" && wikiUrlEntry.trim() !== ""
      ? wikiUrlEntry
      : undefined;
  const tournamentEntry = form.get("tournament");
  const tournamentName =
    typeof tournamentEntry === "string" && tournamentEntry.trim() !== ""
      ? tournamentEntry
      : undefined;
  const dateEntry = form.get("tournamentDate");
  const tournamentDate =
    typeof dateEntry === "string" && dateEntry.trim() !== ""
      ? new Date(dateEntry)
      : undefined;

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
    const file = form.get("image");
    if (file && file instanceof File && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), "public/uploads/players");
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${file.name}`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      imagePath = `/uploads/players/${fileName}`;
    }

    let player;
    let rosterInfo;
    await prisma.$transaction(async (tx) => {
      player = await createPlayer(
        {
          name: parsed.data.name,
          position: parsed.data.position,
          number: parsed.data.number,
          image: imagePath,
          wikiUrl: parsed.data.wikiUrl,
        },
        undefined,
        tx,
      );
      if (tournamentName) {
        rosterInfo = await ensureTournamentRoster(
          tournamentName,
          tx,
          tournamentDate,
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
      rosterInfo = await prisma.roster.findUnique({
        where: { id: rosterInfo.id },
        include: { tournament: true },
      });
    }
    return NextResponse.json({ player, roster: rosterInfo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "選手の登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
