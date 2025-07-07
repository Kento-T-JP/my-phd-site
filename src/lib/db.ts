import Datastore from 'nedb-promises';
import path from 'path';
import type { Player } from '@/types/player';
import { players as defaultPlayers } from '@/data/players';

const db = Datastore.create({
  filename: path.join(process.cwd(), 'players.db'),
  autoload: true,
});

async function ensureSeed() {
  const count = await db.count({});
  if (count === 0) {
    await db.insert(defaultPlayers);
  }
}

export async function getPlayers(): Promise<Player[]> {
  await ensureSeed();
  return db.find<Player>({}).sort({ id: 1 });
}

export default db;
