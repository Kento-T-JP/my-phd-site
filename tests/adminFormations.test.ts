import { describe, it, beforeEach, expect, vi } from 'vitest';
import { newDb } from 'pg-mem';

vi.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    formation: { delete: vi.fn() },
  },
}));

describe('admin formation API', () => {
  let sessionSpy: any;
  let prisma: any;
  let client: any;

  beforeEach(async () => {
    const auth = await import('next-auth/next');
    sessionSpy = auth.getServerSession as any;
    sessionSpy.mockReset();
    sessionSpy.mockResolvedValue({ user: { email: 'a@test.com', isAdmin: true } });

    const db = newDb({ autoCreateForeignKeyIndices: true });
    await db.public.none(`
      CREATE TABLE "Formation" (
        "id" SERIAL PRIMARY KEY
      );
    `);
    await db.public.none(`
      CREATE TABLE "Player" (
        "id" SERIAL PRIMARY KEY
      );
    `);
    await db.public.none(`
      CREATE TABLE "FormationNode" (
        "id" SERIAL PRIMARY KEY,
        "x" DOUBLE PRECISION NOT NULL,
        "y" DOUBLE PRECISION NOT NULL,
        "playerId" INTEGER NOT NULL,
        "formationId" INTEGER NOT NULL,
        CONSTRAINT "FormationNode_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FormationNode_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    const { Client } = db.adapters.createPg();
    client = new Client();
    await client.connect();
    await client.query('INSERT INTO "Formation" VALUES (DEFAULT)');
    await client.query('INSERT INTO "Player" VALUES (DEFAULT)');
    await client.query('INSERT INTO "FormationNode" ("x","y","playerId","formationId") VALUES (0,0,1,1),(1,1,1,1)');

    const mod = await import('@/lib/db');
    prisma = mod.default as any;
    prisma.formation.delete.mockImplementation(async ({ where: { id } }: any) => {
      await client.query('DELETE FROM "Formation" WHERE id = $1', [id]);
      return { id };
    });
  });

  it('cascades nodes when deleting a formation', async () => {
    const { DELETE } = await import('../src/app/api/admin/formations/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    } as any);
    expect(res.status).toBe(200);
    const nodes = await client.query('SELECT * FROM "FormationNode"');
    await client.end();
    expect(nodes.rowCount).toBe(0);
  });
});

