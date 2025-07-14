import { NextResponse } from 'next/server';
import { getPlayers, createPlayer } from '@/lib/db';
import { z } from 'zod';

const PlayerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  position: z.array(z.string()).min(1, { message: "At least one position is required" }),
  number: z.number().int({ message: "Number must be an integer" })
               .min(1, { message: "Number must be at least 1" })
               .max(99, { message: "Number must be at most 99" })
               .optional(),
  image: z.string().url({ message: "Image must be a valid URL" }).optional(),
});

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = PlayerSchema.safeParse(data);
    if (!parsed.success) {
      console.log("Zod validation errors:", parsed.error.issues);
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const player = await createPlayer(parsed.data);
    return NextResponse.json(player, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create player';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
