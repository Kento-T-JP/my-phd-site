import { NextResponse } from 'next/server';
import { getPlayers, createPlayer } from '@/lib/db';
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
    typeof numberEntry === "string" && numberEntry.trim() === ""
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

    const player = await createPlayer({ ...parsed.data, image: imagePath });
    return NextResponse.json(player, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "選手の登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
