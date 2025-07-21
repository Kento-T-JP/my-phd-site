import prisma, { upsertTournament, upsertRoster, addRosterPlayers } from '../src/lib/db';

async function main() {
  // fetch players that still have a tournament value
  const players: { id: number; tournament: string }[] = await prisma.$queryRaw`
    SELECT id, tournament FROM "Player" WHERE tournament IS NOT NULL AND tournament <> ''
  `;
  const groups = new Map<string, number[]>();
  for (const { id, tournament } of players) {
    if (!groups.has(tournament)) groups.set(tournament, []);
    groups.get(tournament)!.push(id);
  }
  const today = new Date();
  for (const [name, ids] of groups) {
    const t = await upsertTournament(name);
    const r = await upsertRoster(t.id, today);
    await addRosterPlayers(r.id, ids);
    console.log(`Created roster for ${name} with ${ids.length} players`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
