# DB Performance Phase 2 Plan

## Branch
- `codex/db-perf-phase2-strategy`

## Current benchmark snapshot (2026-02-16)
Source: `/tmp/db-perf-phase2-current.json`

- `players_list_query_with_links`: avg 4004.75 ms, p95 4744.00 ms
- `players_list_query_lite`: avg 1628.81 ms, p95 1818.25 ms
- `players_list_paged_filtered_query`: avg 538.33 ms, p95 779.59 ms
- `players_list_paged_filtered_query_lite`: avg 187.35 ms, p95 210.18 ms
- `rosters_list_query`: avg 277.25 ms, p95 425.60 ms
- `admin_unique_visitors_old`: avg 7976.96 ms, p95 8603.45 ms
- `admin_unique_visitors_new`: avg 147.96 ms, p95 294.67 ms

Key result:
- Removing `rosterPlayers` from players list query improved average latency by about 59.3%.
- Removing `rosterPlayers` from paged filtered query improved average latency by about 65.2%.

## Interpretation
- `EXPLAIN ANALYZE` shows DB execution itself is very fast for base scans/sorts.
- End-to-end latency is dominated by payload shape and network round-trips, not raw DB scan cost.
- The biggest win is to separate API response shapes by use-case instead of always including linked roster data.

## Phase plan

### Phase 2A (high ROI, low risk): split players response shape
1. Add query option in `/api/players`:
- `includeRosterLinks=1` only when caller needs `rosterPlayers`.
- Default to no `rosterPlayers` for list pages.

2. Apply by caller:
- `/players` page: no `rosterPlayers`.
- `/formations` page: request `includeRosterLinks=1`.
- `/players/[id]/edit`: request only current player detail as already implemented.

3. Validation:
- Re-run `scripts/db-perf-benchmark.mjs`.
- Browser check in Chrome DevTools:
  - `/api/players?paged=1...` p95 target under 300 ms (bench dataset)
  - JSON payload size reduction for players list endpoint.

### Phase 2B (high ROI): cache low-churn master data
Targets:
- `/api/rosters`
- `/api/tournaments`
- `/api/tournaments/names`
- `/api/rosters/titles`

Approach:
- Server-side cache with tags + short TTL (e.g. 30-60s).
- Invalidate on write paths:
  - roster/tournament create/delete
  - player create/update/import when roster linkage changes
- Keep user-scoped cache keying by `userId`.

Validation:
- Measure first load vs repeat load in same session.
- Ensure cache invalidates immediately after create/delete.

### Phase 2C (medium ROI): async write-path batching
Targets:
- `/api/players` POST currently loops rosters and calls `addRosterPlayers` one-by-one.
- `/api/players/import` PUT runs per-row updates in `Promise.all`.

Approach:
- Batch roster-player links in one `createMany` call.
- Chunk large update batches (e.g. 100-300 updates/chunk) to avoid DB spikes.
- Keep idempotency and unique-key safety (`skipDuplicates`).

Validation:
- Add benchmark case for create/import with 1k-row payload.
- Compare request duration and DB error rate under concurrent calls.

## Suggested acceptance criteria
- Players paged API p95 <= 300 ms on benchmark dataset.
- Roster/tournament master fetch repeat call p95 <= 120 ms.
- Import 1000 rows end-to-end <= 2.5 s (no errors, no deadlocks).

## Recommended implementation order
1. Phase 2A response shape split (`includeRosterLinks`).
2. Phase 2B cache + invalidation for roster/tournament read APIs.
3. Phase 2C async batching for write paths.

This order gives immediate visible speed-up on players list while keeping risk low.
