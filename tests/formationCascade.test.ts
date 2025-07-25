import { describe, it, expect } from 'vitest';
import { newDb } from 'pg-mem';

// Confirm that FormationNode rows are deleted when the parent Formation is deleted
// according to the ON DELETE CASCADE foreign key

describe('FormationNode cascade delete', () => {
  it('removes nodes when a formation is deleted', async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    const { Client } = db.adapters.createPg();

    // Minimal schema with cascade foreign key matching prisma migration
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

    const client = new Client();
    await client.connect();
    await client.query('INSERT INTO "Formation" VALUES (DEFAULT)');
    await client.query('INSERT INTO "Player" VALUES (DEFAULT)');
    await client.query('INSERT INTO "FormationNode" ("x", "y", "playerId", "formationId") VALUES (0, 0, 1, 1), (1, 1, 1, 1)');

    // Delete the formation and check nodes were cascaded
    await client.query('DELETE FROM "Formation" WHERE id = 1');
    const res = await client.query('SELECT * FROM "FormationNode"');
    await client.end();
    expect(res.rowCount).toBe(0);
  });
});
