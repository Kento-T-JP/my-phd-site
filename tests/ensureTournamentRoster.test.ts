import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureTournamentRoster } from '@/lib/db';

interface MockClient {
  tournament: { findFirst: any; upsert: any };
  roster: { findFirst: any; create: any; upsert: any; findUniqueOrThrow: any };
}

let client: MockClient;
let rosters: any[];
let nextId: number;

function findFirstImpl(args: any) {
  if (args.where?.OR) {
    const { tournamentId } = args.where;
    const [cond1, cond2] = args.where.OR;
    return (
      rosters.find(
        (r) =>
          r.tournamentId === tournamentId &&
          ((cond1.date && r.date.getTime() === cond1.date.getTime()) ||
            (cond2.title && r.title === cond2.title))
      ) || null
    );
  }
  if (args.where?.tournamentId && args.orderBy) {
    const list = rosters.filter((r) => r.tournamentId === args.where.tournamentId);
    if (list.length === 0) return null;
    return list.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  }
  return null;
}

function createImpl({ data }: any) {
  const rec = { id: nextId++, ...data };
  rosters.push(rec);
  return rec;
}

describe('ensureTournamentRoster', () => {
  beforeEach(() => {
    rosters = [];
    nextId = 1;
    client = {
      tournament: {
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: 1, name: 'Cup' })),
      },
      roster: {
        findFirst: vi.fn(findFirstImpl),
        create: vi.fn(createImpl),
        findUniqueOrThrow: vi.fn(async ({ where }: any) =>
          rosters.find((r) => r.id === where.id) ?? null
        ),
        upsert: vi.fn(({ create }: any) => {
          const existing = rosters.find(
            (r) =>
              r.tournamentId === create.tournamentId && r.title === create.title
          );
          if (existing) return existing;
          return createImpl({ data: create });
        }),
      },
    };
  });

  it('creates rosters with different dates', async () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-02-01');

    const r1 = await ensureTournamentRoster('Cup', 1, client as any, d1);
    const r2 = await ensureTournamentRoster('Cup', 1, client as any, d2);

    expect(r1.id).not.toBe(r2.id);
    expect(r1.date).toEqual(d1);
    expect(r2.date).toEqual(d2);
    expect(client.roster.upsert).toHaveBeenCalledTimes(2);
  });
});
