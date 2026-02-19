"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  type CSSProperties,
  useRef,
  useCallback,
  useTransition,
  Profiler,
} from "react";
import Image from "next/image";
import Link from "next/link";
import WikiLink from "@/components/WikiLink";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Player, PositionKey, Roster } from "@/types/player";
import { formations } from "@/data/formations";
import type { Formation, SavedFormation } from "@/types/formation";
import PlayerFilter from "@/components/PlayerFilter";
import MultiToggleGroup from "@/components/MultiToggleGroup";
import useClickSound from "@/lib/useClickSound";

export interface InitialFormation {
  id?: number;
  name: string;
  positions: {
    lineupOrder: number[];
    benchOrder: number[];
    benchSize?: number;
    offBenchSize?: number;
    playerPositions: Record<number, { top: number; left: number }>;
    baseFormationName?: string;
  };
}

export interface FormationState {
  lineupOrder: number[];
  benchOrder: number[];
  benchSize?: number;
  offBenchSize?: number;
  playerPositions: Record<number, { top: number; left: number }>;
}

interface Dragging {
  id: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
}

/** horizontal spacing between players in the same line (percentage points) */
const OFFSET_STEP = 24;
const clampPercent = (value: number, min = 6, max = 94) =>
  Math.min(max, Math.max(min, value));


const BENCH_POSITION_ORDER = ["GK", "DF", "MF", "MF/FW", "FW"];
const DEFAULT_BENCH_LIMIT = 12;
const MAX_BENCH_LIMIT = 15;
const DEFAULT_OFF_BENCH_LIMIT = 999;
const DEFAULT_FORMATION_NAME = "4-3-3";

function normalizeBenchSize(value: unknown, fallback = DEFAULT_BENCH_LIMIT): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(MAX_BENCH_LIMIT, Math.trunc(value)));
  }
  return Math.max(0, Math.min(MAX_BENCH_LIMIT, Math.trunc(fallback)));
}

function normalizeOffBenchSize(value: unknown, fallback = DEFAULT_OFF_BENCH_LIMIT): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(DEFAULT_OFF_BENCH_LIMIT, Math.trunc(value)));
  }
  return Math.max(0, Math.min(DEFAULT_OFF_BENCH_LIMIT, Math.trunc(fallback)));
}

export interface PlayerFilterOptions {
  name?: string;
  rosterId?: number;
  rosterIds?: number[];
  tournamentId?: number;
  position?: string;
  positions?: string[];
  favoriteOnly?: boolean;
}

export function resolveFormationTemplate(
  initial: Pick<InitialFormation, "name" | "positions"> | undefined,
  fallback: Formation
): Formation {
  const templateName = initial?.positions?.baseFormationName ?? initial?.name;
  return formations.find((f) => f.name === templateName) ?? fallback;
}

export function filterPlayers<
  T extends Player & { rosterPlayers?: { rosterId: number; roster?: { tournamentId: number } }[] }
>(list: T[], opts: PlayerFilterOptions = {}): T[] {
  const name = opts.name?.toLowerCase() ?? "";
  const rosterIds = new Set<number>([
    ...(opts.rosterId === undefined ? [] : [opts.rosterId]),
    ...(opts.rosterIds ?? []),
  ]);
  const selectedPositions = Array.from(
    new Set(
      [
        ...(opts.position ? [opts.position] : []),
        ...(opts.positions ?? []),
      ]
        .map((p) => p.toLowerCase().trim())
        .filter(Boolean)
    )
  );
  return list.filter((p) => {
    const matchName = !name || p.name.toLowerCase().includes(name);
    const matchRoster =
      rosterIds.size === 0 ||
      (p.rosterPlayers ?? []).some((rp) => rosterIds.has(rp.rosterId));
    const matchTournament =
      opts.tournamentId === undefined ||
      (p.rosterPlayers ?? []).some(
        (rp) => rp.roster?.tournamentId === opts.tournamentId
      );
    const matchPos =
      selectedPositions.length === 0 ||
      p.position.some((pp) => {
        const normalized = pp.toLowerCase();
        return selectedPositions.some((pos) => normalized.includes(pos));
      });
    return matchName && matchRoster && matchTournament && matchPos;
  });
}

function getBenchSortPos(p: Player): string {
  const pos = p.position;
  if (pos.includes("MF/FW") || pos.includes("MF") || pos.includes("FW")) {
    return "MF/FW";
  }
  return pos[0] ?? "";
}

function sortBenchIdsForInitialLayout(
  ids: number[],
  players: Player[]
): number[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  return [...ids].sort((a, b) => {
    const pa = playerById.get(a);
    const pb = playerById.get(b);
    if (!pa && !pb) return a - b;
    if (!pa) return 1;
    if (!pb) return -1;
    const posA = getBenchSortPos(pa);
    const posB = getBenchSortPos(pb);
    const idxA = BENCH_POSITION_ORDER.indexOf(posA);
    const idxB = BENCH_POSITION_ORDER.indexOf(posB);
    if (idxA === -1 && idxB === -1) return posA.localeCompare(posB);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

/* ───────── util: 初期スタメン計算 ───────── */
function makeInitialFieldIds(fm: Formation, list: Player[]): Set<number> {
  const chosen = new Set<number>();

  const keys = Object.keys(fm.positions);

  keys.forEach((posKey) => {
    const slot = fm.positions[posKey as keyof typeof fm.positions];
    if (!slot) return;

    /* ① position が合う選手を優先して埋める */
    const fit = list
      .filter((p) =>
        !chosen.has(p.id) &&
        (slot.allowed
          ? p.position.some((pos) => slot.allowed!.includes(pos))
          : p.position.includes(posKey))
      )
      .slice(0, slot.max);

    fit.forEach((pl) => {
      chosen.add(pl.id);
    });

    /* ② 足りない分を残りから埋める */
    const need = slot.max - fit.length;
    if (need > 0) {
      list
        .filter((p) => !chosen.has(p.id))
        .slice(0, need)
        .forEach((pl) => {
          chosen.add(pl.id);
        });
    }
  });

  return chosen;
}

/** 初回カスタムモード突入時に on‑field 全員の現在デフォルト座標を固定化 */
const freezeDefaults = (
  defaultsFrozen: boolean,
  setDefaultsFrozen: React.Dispatch<React.SetStateAction<boolean>>,
  lineupOrder: number[],
  formation: Formation,
  playerPositions: Record<number, { top: number; left: number }>,
  setPlayerPositions: React.Dispatch<React.SetStateAction<Record<number, { top: number; left: number }>>>,
  step: number = OFFSET_STEP,
  adjustLeft: (left: number) => number = (left) => left
) => {
  if (defaultsFrozen) return;
  const newPos: typeof playerPositions = {};

  let idx = 0;
  const idsArray = lineupOrder;               // 11 人の順序
  Object.keys(formation.positions).forEach((posKey) => {
    const base = formation.positions[posKey as keyof typeof formation.positions];
    if (!base) return;

    for (let i = 0; i < base.max && idx < idsArray.length; i++) {
      const pid = idsArray[idx++];
      if (!playerPositions[pid]) {
        const offset = (base.max > 1 ? (i - (base.max - 1) / 2) * step : 0);
        newPos[pid] = { top: base.top, left: adjustLeft(base.left) + offset };
      }
    }
  });

  setPlayerPositions((prev) => ({ ...newPos, ...prev }));
  setDefaultsFrozen(true);
};

const buildDefaultPositionMap = (
  lineupOrder: number[],
  formation: Formation,
  step: number = OFFSET_STEP,
  adjustLeft: (left: number) => number = (left) => left
) => {
  const positions: Record<number, { top: number; left: number }> = {};
  let idx = 0;
  Object.keys(formation.positions).forEach((posKey) => {
    const base = formation.positions[posKey as keyof typeof formation.positions];
    if (!base) return;
    for (let i = 0; i < base.max && idx < lineupOrder.length; i++) {
      const pid = lineupOrder[idx++];
      const offset = base.max > 1 ? (i - (base.max - 1) / 2) * step : 0;
      const baseLeft = adjustLeft(base.left);
      positions[pid] = {
        top: clampPercent(base.top),
        left: clampPercent(baseLeft + offset),
      };
    }
  });
  return positions;
};

export default function Formation({
  initialFormation: initialFormationProp,
  onSaved,
  onUpdated,
  screenshotMode = false,
}: {
  initialFormation?: InitialFormation;
  onSaved?: (saved: SavedFormation) => void;
  onUpdated?: () => void;
  screenshotMode?: boolean;
}) {
  const [initialFormation, setInitialFormation] = useState<
    InitialFormation | undefined
  >(initialFormationProp);
  /* ───────── state ───────── */
  const defaultFormation =
    formations.find((f) => f.name === DEFAULT_FORMATION_NAME) ?? formations[0];
  const base = resolveFormationTemplate(initialFormation, defaultFormation);
  const [formation, setFormation] = useState<Formation>(base);
  const [lineupOrder, setLineupOrder] = useState<number[]>(
    initialFormation?.positions.lineupOrder ?? []
  );
  const [benchOrder, setBenchOrder] = useState<number[]>(
    initialFormation?.positions.benchOrder ?? []
  );
  const [benchSize, setBenchSize] = useState<number>(
    normalizeBenchSize(initialFormation?.positions.benchSize, DEFAULT_BENCH_LIMIT)
  );
  const [playerPositions, setPlayerPositions] = useState<
    Record<number, { top: number; left: number }>
  >(initialFormation?.positions.playerPositions ?? {});
  const [players, setPlayers] = useState<
    (Player & { rosterPlayers?: { rosterId: number; roster?: { tournamentId: number } }[] })[]
  >([]);
  const [managedPositions, setManagedPositions] = useState<string[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIsBench, setSelectedIsBench] = useState<boolean | null>(null);

  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tempoPulseId, setTempoPulseId] = useState<number | null>(null);
  const tempoPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [frontmostId, setFrontmostId] = useState<number | null>(null);

  const [customMode, setCustomMode] = useState(false);  // false = 初期オート, true = ユーザー自由
  const [defaultsFrozen, setDefaultsFrozen] = useState(false);
  const [filter, setFilter] = useState<PlayerFilterOptions>({});
  const [showPlayerFilters, setShowPlayerFilters] = useState(false);
  const [offBenchNameFilter, setOffBenchNameFilter] = useState("");
  const [offBenchPositionFilters, setOffBenchPositionFilters] = useState<string[]>([]);
  const [offBenchLimit, setOffBenchLimit] = useState(
    normalizeOffBenchSize(initialFormation?.positions.offBenchSize, DEFAULT_OFF_BENCH_LIMIT)
  );
  const [showOffBenchFilters, setShowOffBenchFilters] = useState(false);
  const [alias, setAlias] = useState(initialFormation?.name ?? "");

  const toTemplateStateKey = (name: string) => `template:${name}`;
  const toSavedStateKey = (id: number) => `saved:${id}`;
  const initialSavedStateKey =
    initialFormation?.id != null ? toSavedStateKey(initialFormation.id) : undefined;

  const [, startTransition] = useTransition();

  const [formationStates, setFormationStates] = useState<Record<string, FormationState>>(
    initialFormation && initialSavedStateKey
      ? {
          [initialSavedStateKey]: {
            lineupOrder: initialFormation.positions.lineupOrder ?? [],
            benchOrder: initialFormation.positions.benchOrder ?? [],
            benchSize: normalizeBenchSize(
              initialFormation.positions.benchSize,
              DEFAULT_BENCH_LIMIT
            ),
            offBenchSize: normalizeOffBenchSize(
              initialFormation.positions.offBenchSize,
              DEFAULT_OFF_BENCH_LIMIT
            ),
            playerPositions: initialFormation.positions.playerPositions ?? {},
          },
        }
      : {}
  );

  const { data: session } = useSession();
  const router = useRouter();
  const { play } = useClickSound();
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [fieldWidth, setFieldWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const prevFilterSignatureRef = useRef<string | null>(null);

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        name: filter.name ?? "",
        rosterId: filter.rosterId ?? null,
        rosterIds: [...(filter.rosterIds ?? [])].sort((a, b) => a - b),
        tournamentId: filter.tournamentId ?? null,
        position: filter.position ?? "",
        positions: [...(filter.positions ?? [])].sort(),
        favoriteOnly: Boolean(filter.favoriteOnly),
      }),
    [filter]
  );
  const playerFilterActiveCount =
    (filter.name?.trim() ? 1 : 0) +
    ((filter.rosterIds?.length ?? 0) > 0 ? 1 : 0) +
    ((filter.positions?.length ?? 0) > 0 ? 1 : 0) +
    (filter.favoriteOnly ? 1 : 0);

  const positionOptions = useMemo(() => {
    return Array.from(new Set(players.flatMap((p) => p.position))).sort(
      (a, b) => a.localeCompare(b, "ja")
    ) as PositionKey[];
  }, [players]);

  const toggleFavorite = async (id: number) => {
    play();
    if (!session) {
      router.push("/login");
      return;
    }
    const isFav = favorites.has(id);
    setFavorites((prev) => {
      const s = new Set(prev);
      if (isFav) s.delete(id);
      else s.add(id);
      return s;
    });
    await fetch("/api/favorites", {
      method: isFav ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: id }),
    });
  };

  useEffect(() => {
    setInitialFormation(initialFormationProp);
  }, [initialFormationProp]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (tempoPulseTimeoutRef.current) clearTimeout(tempoPulseTimeoutRef.current);
    };
  }, []);

  // update when a different formation is supplied from props
  useEffect(() => {
    if (!initialFormation) return;
    const savedId = initialFormation.id;
    const base = resolveFormationTemplate(initialFormation, defaultFormation);
    setFormation(base);
    setLineupOrder(initialFormation.positions.lineupOrder ?? []);
    setBenchOrder(initialFormation.positions.benchOrder ?? []);
    setBenchSize(
      normalizeBenchSize(initialFormation.positions.benchSize, DEFAULT_BENCH_LIMIT)
    );
    setOffBenchLimit(
      normalizeOffBenchSize(
        initialFormation.positions.offBenchSize,
        DEFAULT_OFF_BENCH_LIMIT
      )
    );
    setPlayerPositions(initialFormation.positions.playerPositions ?? {});
    if (savedId != null) {
      setFormationStates((prev) => ({
        ...prev,
        [toSavedStateKey(savedId)]: {
          lineupOrder: initialFormation.positions.lineupOrder ?? [],
          benchOrder: initialFormation.positions.benchOrder ?? [],
          benchSize: normalizeBenchSize(
            initialFormation.positions.benchSize,
            DEFAULT_BENCH_LIMIT
          ),
          offBenchSize: normalizeOffBenchSize(
            initialFormation.positions.offBenchSize,
            DEFAULT_OFF_BENCH_LIMIT
          ),
          playerPositions: initialFormation.positions.playerPositions ?? {},
        },
      }));
    }
    setAlias(initialFormation.name ?? "");
    setCustomMode(false);
    setDefaultsFrozen(false);
    setSelectedId(null);
    setSelectedIsBench(null);
  }, [defaultFormation, initialFormation]);

  const fetchRosters = useCallback(async () => {
    try {
      const res = await fetch('/api/rosters');
      if (!res.ok) throw new Error('Failed to fetch rosters');
      const data: Roster[] = await res.json();
      setRosters(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    async function loadFavorites() {
      try {
        const res = await fetch('/api/favorites');
        if (res.ok) {
          const favs = (await res.json()) as Player[];
          setFavorites(new Set(favs.map((f) => f.id)));
        }
      } catch {
        // ignore errors
      }
    }
    loadFavorites();
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading) return;
    const target = fieldRef.current;
    if (!target) return;
    let rafId: number | null = null;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    let lastAppliedAt = 0;
    const RESIZE_THROTTLE_MS = 120;
    const update = () => {
      const rectWidth = Math.round(target.getBoundingClientRect().width);
      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;
      const fullscreen = Boolean(document.fullscreenElement);
      setFieldWidth((prev) => (Math.abs(prev - rectWidth) < 1 ? prev : rectWidth));
      setViewportWidth((prev) => (prev === innerWidth ? prev : innerWidth));
      setViewportHeight((prev) => (prev === innerHeight ? prev : innerHeight));
      setIsBrowserFullscreen((prev) => (prev === fullscreen ? prev : fullscreen));
    };
    const scheduleUpdate = (force = false) => {
      const now = Date.now();
      if (!force && now - lastAppliedAt < RESIZE_THROTTLE_MS) {
        if (debounceId !== null) {
          clearTimeout(debounceId);
        }
        debounceId = setTimeout(() => {
          scheduleUpdate(true);
        }, RESIZE_THROTTLE_MS);
        return;
      }
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        update();
        lastAppliedAt = Date.now();
        rafId = null;
      });
    };
    const triggerResizeUpdate = () => {
      scheduleUpdate();
    };
    update();
    const observer = new ResizeObserver(() => triggerResizeUpdate());
    observer.observe(target);
    document.addEventListener("fullscreenchange", triggerResizeUpdate);
    window.addEventListener("orientationchange", triggerResizeUpdate);
    window.addEventListener("resize", triggerResizeUpdate);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", triggerResizeUpdate);
      window.removeEventListener("orientationchange", triggerResizeUpdate);
      window.removeEventListener("resize", triggerResizeUpdate);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (debounceId !== null) {
        clearTimeout(debounceId);
      }
    };
  }, [loading]);
  const filteredPlayers = useMemo(() => {
    const list = filterPlayers(players, filter);
    if (!filter.favoriteOnly) return list;
    return list.filter((p) => favorites.has(p.id));
  }, [favorites, filter, players]);

  let orderIndex = 0; // そのまま利用（変更不要）

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/players?includeRosterLinks=1&includeExtra=0');
      if (!res.ok) throw new Error('プレイヤー取得に失敗しました');
      const data: (Player & { rosterPlayers?: { rosterId: number }[] })[] = await res.json();
      setPlayers(data.filter((p) => p.position.length > 0));
    } catch (err) {
      console.error(err);
      setError('プレイヤーの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchRosters();
  }, [session?.user?.id, fetchPlayers, fetchRosters]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const loadManagedPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        if (!res.ok) throw new Error("Failed to fetch positions");
        const data = (await res.json()) as { id: number; name: string }[];
        setManagedPositions(data.map((item) => item.name));
      } catch {
        setManagedPositions([]);
      }
    };
    void loadManagedPositions();
    const refresh = () => {
      void loadManagedPositions();
    };
    window.addEventListener("position-saved", refresh);
    return () => {
      window.removeEventListener("position-saved", refresh);
    };
  }, [session?.user?.id]);

  const refetchPlayersAndRosters = useCallback(() => {
    fetchPlayers();
    fetchRosters();
  }, [fetchPlayers, fetchRosters]);

  useEffect(() => {
    const handlePositionAdded = () => {
      refetchPlayersAndRosters();
    };
    window.addEventListener('position-added', handlePositionAdded);
    return () => {
      window.removeEventListener('position-added', handlePositionAdded);
    };
  }, [refetchPlayersAndRosters]);

  // initialize ids when players or formation change and no initial lineup
  useEffect(() => {
    if (filteredPlayers.length === 0) {
      if (lineupOrder.length === 0) {
        setBenchOrder([]);
        setLineupOrder([]);
      }
      return;
    }
    if (lineupOrder.length > 0) {
      setLoading(false);
      return;
    }
    const ids = makeInitialFieldIds(formation, filteredPlayers);
    setBenchOrder(
      sortBenchIdsForInitialLayout(
        filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id)),
        filteredPlayers
      )
    );
    setLineupOrder(Array.from(ids));
    setLoading(false);
  }, [filteredPlayers, formation, lineupOrder.length]);


  /* ───────── drag handler ───────── */
  useEffect(() => {
    let rafId: number | null = null;
    let nextLeft = 0;
    let nextTop = 0;

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        setPlayerPositions((prev) => {
          const prevPos = prev[dragging!.id];
          // 位置がほぼ変わらない（0.2% 未満）の場合は更新しない
          if (prevPos && Math.abs(prevPos.left - nextLeft) < 0.2 && Math.abs(prevPos.top - nextTop) < 0.2) {
            return prev;
          }
          return { ...prev, [dragging!.id]: { top: nextTop, left: nextLeft } };
        });
        rafId = null;
      });
    };

    const move = (e: PointerEvent) => {
      if (!dragging) return;
      if (e.pointerId !== dragging.pointerId) return;
      const field = document.querySelector(".field") as HTMLElement | null;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      nextLeft = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
      nextTop = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;
      scheduleUpdate();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      if (e.pointerId !== dragging.pointerId) return;
      setDragging(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [dragging]);

  /* ───────── swap (bench ↔ field) ───────── */
  const handleClick = (id: number, isBench: boolean) => {
    play();
    const t0 = performance.now();
    startTransition(() => {
      if (!isBench) {
        setFrontmostId(id);
      }
      // Track rapid click sequences for tempo pulse
      if (lastClickedId === id) {
        const newCount = clickCount + 1;
        if (newCount >= 11) {
          setTempoPulseId(id);
          setClickCount(0);
          setLastClickedId(null);
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
          if (tempoPulseTimeoutRef.current)
            clearTimeout(tempoPulseTimeoutRef.current);
          tempoPulseTimeoutRef.current = setTimeout(() => {
            setTempoPulseId(null);
          }, 1000);
        } else {
          setClickCount(newCount);
          if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = setTimeout(() => {
            setClickCount(0);
            setLastClickedId(null);
          }, 5000);
        }
      } else {
        setLastClickedId(id);
        setClickCount(1);
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = setTimeout(() => {
          setClickCount(0);
          setLastClickedId(null);
        }, 5000);
      }

      if (selectedId === null) {
        setSelectedId(id);
        setSelectedIsBench(isBench);
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedIsBench(null);
        return;
      }
      if (selectedIsBench === isBench) {
        if (isBench) {
          /* --- Bench↔Bench: swap order in benchOrder --- */
          const a = selectedId;
          const b = id;
          setBenchOrder((prev) => {
            const arr = [...prev];
            const ia = arr.indexOf(a);
            const ib = arr.indexOf(b);
            if (ia !== -1 && ib !== -1) {
              [arr[ia], arr[ib]] = [arr[ib], arr[ia]];
            }
            return arr;
          });
        } else {
          /* --- Field↔Field: swap coordinates --- */
          setPlayerPositions((prev) => {
            const defaults = buildDefaultPositionMap(
              lineupOrder,
              formation,
              adaptiveOffsetStep,
              adjustBaseLeft
            );
            const posA = prev[selectedId] ?? defaults[selectedId];
            const posB = prev[id] ?? defaults[id];
            return {
              ...prev,
              [selectedId]: posB,
              [id]: posA,
            };
          });
        }
        setSelectedId(null);
        setSelectedIsBench(null);
        return;
      }

      const benchId = selectedIsBench ? selectedId : id;
      const fieldId = selectedIsBench ? id : selectedId;

      // swap lists

      /* --- update benchOrder: replace benchId with fieldId --- */
      setBenchOrder((prev) => {
        const arr = [...prev];
        const idx = arr.indexOf(benchId);
        if (idx !== -1) {
          arr[idx] = fieldId; // 出て行く fieldId がベンチ側へ
        }
        return arr;
      });

      setLineupOrder((prev) => prev.map((x) => (x === fieldId ? benchId : x)));

      // pos swap (bench gets field coord, field coord removed)
      setPlayerPositions((prev) => {
        const defaults = buildDefaultPositionMap(
          lineupOrder,
          formation,
          adaptiveOffsetStep,
          adjustBaseLeft
        );
        const fieldPos = prev[fieldId] ?? defaults[fieldId] ?? { top: 50, left: 50 };
        const copy = { ...prev };
        copy[benchId] = fieldPos;
        delete copy[fieldId];
        return copy;
      });

      if (!customMode)
        freezeDefaults(
          defaultsFrozen,
          setDefaultsFrozen,
          lineupOrder,
          formation,
          playerPositions,
          setPlayerPositions,
          adaptiveOffsetStep,
          adjustBaseLeft
        );
      setCustomMode(true);

      setSelectedId(null);
      setSelectedIsBench(null);
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`handleClick ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  const handleFormationChange = (f: Formation) => {
    play();
    const currentTemplateKey = toTemplateStateKey(formation.name);
    const nextTemplateKey = toTemplateStateKey(f.name);
    // save current state for existing formation
    setFormationStates((prev) => ({
      ...prev,
      [currentTemplateKey]: {
        lineupOrder,
        benchOrder,
        benchSize,
        offBenchSize: offBenchLimit,
        playerPositions,
      },
    }));

    const saved = formationStates[nextTemplateKey];
    if (saved) {
      setLineupOrder(saved.lineupOrder);
      setBenchOrder(saved.benchOrder);
      setBenchSize(normalizeBenchSize(saved.benchSize, benchSize));
      setOffBenchLimit(
        normalizeOffBenchSize(saved.offBenchSize, offBenchLimit)
      );
      setPlayerPositions(saved.playerPositions);
      const hasCustom = Object.keys(saved.playerPositions).length > 0;
      setCustomMode(hasCustom);
      setDefaultsFrozen(hasCustom);
    } else {
      const ids = makeInitialFieldIds(f, filteredPlayers);
      setLineupOrder(Array.from(ids));
      setBenchOrder(
        sortBenchIdsForInitialLayout(
          filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id)),
          filteredPlayers
        )
      );
      setBenchSize(benchSize);
      setOffBenchLimit(offBenchLimit);
      setPlayerPositions({});
      setCustomMode(false);
      setDefaultsFrozen(false);
    }
    setFormation(f);
    setSelectedId(null);
    setSelectedIsBench(null);
  };

  const handleReset = () => {
    const ids = makeInitialFieldIds(formation, filteredPlayers);
    const newState: FormationState = {
      lineupOrder: Array.from(ids),
      benchOrder: sortBenchIdsForInitialLayout(
        filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id)),
        filteredPlayers
      ),
      benchSize,
      offBenchSize: offBenchLimit,
      playerPositions: {},
    };
    setBenchOrder(newState.benchOrder);
    setLineupOrder(newState.lineupOrder);
    setPlayerPositions(newState.playerPositions);
    setFormationStates((prev) => ({
      ...prev,
      [toTemplateStateKey(formation.name)]: newState,
    }));
    setCustomMode(false);
    setDefaultsFrozen(false);
    setSelectedId(null);
    setSelectedIsBench(null);
  };

  const handleRestoreSaved = () => {
    if (!initialFormation) return;
    const savedId = initialFormation.id;
    const restored = resolveFormationTemplate(initialFormation, defaultFormation);
    setFormation(restored);
    setLineupOrder(initialFormation.positions.lineupOrder ?? []);
    setBenchOrder(initialFormation.positions.benchOrder ?? []);
    setBenchSize(
      normalizeBenchSize(initialFormation.positions.benchSize, DEFAULT_BENCH_LIMIT)
    );
    setOffBenchLimit(
      normalizeOffBenchSize(
        initialFormation.positions.offBenchSize,
        DEFAULT_OFF_BENCH_LIMIT
      )
    );
    setPlayerPositions(initialFormation.positions.playerPositions ?? {});
    setFormationStates((prev) => {
      const next: Record<string, FormationState> = {
        ...prev,
        [toTemplateStateKey(restored.name)]: {
          lineupOrder: initialFormation.positions.lineupOrder ?? [],
          benchOrder: initialFormation.positions.benchOrder ?? [],
          benchSize: normalizeBenchSize(
            initialFormation.positions.benchSize,
            DEFAULT_BENCH_LIMIT
          ),
          offBenchSize: normalizeOffBenchSize(
            initialFormation.positions.offBenchSize,
            DEFAULT_OFF_BENCH_LIMIT
          ),
          playerPositions: initialFormation.positions.playerPositions ?? {},
        },
      };
      if (savedId != null) {
        next[toSavedStateKey(savedId)] = {
          lineupOrder: initialFormation.positions.lineupOrder ?? [],
          benchOrder: initialFormation.positions.benchOrder ?? [],
          benchSize: normalizeBenchSize(
            initialFormation.positions.benchSize,
            DEFAULT_BENCH_LIMIT
          ),
          offBenchSize: normalizeOffBenchSize(
            initialFormation.positions.offBenchSize,
            DEFAULT_OFF_BENCH_LIMIT
          ),
          playerPositions: initialFormation.positions.playerPositions ?? {},
        };
      }
      return next;
    });
    setCustomMode(false);
    setDefaultsFrozen(false);
    setSelectedId(null);
    setSelectedIsBench(null);
  };

  const handleSave = async () => {
    play();
    if (!session) {
      alert("Please log in to save your formation.");
      return;
    }
    const name = alias.trim() || formation.name;
    if (
      initialFormation?.id &&
      name.toLowerCase() === (initialFormation.name ?? "").trim().toLowerCase()
    ) {
      await handleUpdate();
      return;
    }
    if (!window.confirm('Save formation "' + name + '"?')) {
      return;
    }
    const t0 = performance.now();
    startTransition(() => setIsSaving(true));
    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          positions: {
            lineupOrder,
            benchOrder,
            benchSize: normalizeBenchSize(benchSize, DEFAULT_BENCH_LIMIT),
            offBenchSize: normalizeOffBenchSize(
              offBenchLimit,
              DEFAULT_OFF_BENCH_LIMIT
            ),
            playerPositions,
            baseFormationName: formation.name,
          },
        }),
      });
      if (res.ok) {
        const saved = (await res.json()) as SavedFormation;
        alert("保存しました");
        startTransition(() => setInitialFormation(saved));
        onSaved?.(saved);
      } else {
        const data = await res.json();
        alert(
          typeof data?.error === "string"
            ? data.error
            : "保存に失敗しました"
        );
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      startTransition(() => setIsSaving(false));
      if (process.env.NODE_ENV !== "production") {
        console.log(`handleSave ${(performance.now() - t0).toFixed(2)}ms`);
      }
    }
  };

  const handleUpdate = async () => {
    play();
    if (!session || !initialFormation?.id) {
      alert("更新するフォーメーションがありません");
      return;
    }
    const name = alias.trim() || formation.name;
    if (!window.confirm('フォーメーション「' + name + '」を更新しますか?')) {
      return;
    }
    try {
      const res = await fetch(`/api/formations/${initialFormation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          positions: {
            lineupOrder,
            benchOrder,
            benchSize: normalizeBenchSize(benchSize, DEFAULT_BENCH_LIMIT),
            offBenchSize: normalizeOffBenchSize(
              offBenchLimit,
              DEFAULT_OFF_BENCH_LIMIT
            ),
            playerPositions,
            baseFormationName: formation.name,
          },
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as SavedFormation;
        alert("更新しました");
        startTransition(() => setInitialFormation(updated));
        onUpdated?.();
      } else {
        const data = await res.json();
        alert(
          typeof data?.error === "string"
            ? data.error
            : "更新に失敗しました"
        );
      }
    } catch {
      alert("更新に失敗しました");
    }
  };

  const handleProfilerRender = useCallback(
    (id: string, phase: "mount" | "update" | "nested-update", actualDuration: number) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Profiler:${id} ${phase} ${actualDuration.toFixed(2)}ms`);
      }
    },
    []
  );

  useEffect(() => {
    const prev = prevFilterSignatureRef.current;
    prevFilterSignatureRef.current = filterSignature;
    // Skip initial mount and semantically no-op filter updates.
    if (prev == null || prev === filterSignature) {
      return;
    }
    handleReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  /* ───────── render helpers ───────── */
  // track which IDs have already been drawn this frame
  const drawn = new Set<number>();

  const sortedKeys = Object.keys(formation.positions);

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  const playerById = new Map(players.map((p) => [p.id, p]));
  const canAppearOnBench = (id: number): boolean => {
    const p = playerById.get(id);
    if (!p || p.role !== "player") return false;
    return p.position.some((pos) => BENCH_POSITION_ORDER.includes(pos));
  };
  const benchCandidateIds = benchOrder.filter(canAppearOnBench);
  const normalizedBenchSize = normalizeBenchSize(benchSize, DEFAULT_BENCH_LIMIT);
  const effectiveBenchSize = Math.min(
    benchCandidateIds.length,
    normalizedBenchSize,
    MAX_BENCH_LIMIT
  );
  const benchControlMax = Math.min(MAX_BENCH_LIMIT, benchCandidateIds.length);
  const benchControlValue = Math.min(normalizedBenchSize, benchControlMax);
  const benchIds = benchCandidateIds.slice(0, effectiveBenchSize);
  const benchIdSet = new Set(benchIds);
  // Preserve benchOrder-relative order for off-bench instead of regrouping.
  const benchOutIds = benchOrder.filter((id) => !benchIdSet.has(id));
  const benchPlayers = benchIds
    .map((id) => playerById.get(id))
    .filter((p): p is Player => Boolean(p));
  const benchOutPlayersAll = benchOutIds
    .map((id) => playerById.get(id))
    .filter((p): p is Player => Boolean(p));
  const offBenchNameNeedle = offBenchNameFilter.trim().toLowerCase();
  const offBenchPositionNeedles = offBenchPositionFilters
    .map((pos) => pos.toLowerCase().trim())
    .filter(Boolean);
  const offBenchPositionOptions = Array.from(
    new Set(benchOutPlayersAll.flatMap((p) => p.position))
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const offBenchByFilter = benchOutPlayersAll.filter((p) => {
    const matchName =
      !offBenchNameNeedle || p.name.toLowerCase().includes(offBenchNameNeedle);
    const matchPosition =
      offBenchPositionNeedles.length === 0 ||
      p.position.some((pp) => {
        const normalized = pp.toLowerCase();
        return offBenchPositionNeedles.some((needle) =>
          normalized.includes(needle)
        );
      });
    return matchName && matchPosition;
  });
  const offBenchFilterMax = offBenchByFilter.length;
  const offBenchLimitValue = Math.min(
    Math.max(0, offBenchLimit),
    offBenchFilterMax
  );
  const offBenchFilterActiveCount =
    (offBenchNameFilter.trim() ? 1 : 0) +
    (offBenchPositionFilters.length > 0 ? 1 : 0) +
    (offBenchLimitValue < offBenchFilterMax ? 1 : 0);
  const offBenchPlayers = offBenchByFilter.slice(0, offBenchLimitValue);
  const responsiveWidth = viewportWidth > 0 ? viewportWidth : fieldWidth;
  const isCompactLayout = responsiveWidth > 0 ? responsiveWidth < 960 : false;
  const widthScale = responsiveWidth > 0 ? responsiveWidth / 1366 : 1;
  const heightScale = viewportHeight > 0 ? viewportHeight / 820 : 1;
  const uiScale = screenshotMode
    ? 0.9
    : Math.max(0.8, Math.min(1.52, Math.min(widthScale, heightScale) * 1.06));
  const isLargeViewport =
    !screenshotMode && viewportWidth >= 1280 && viewportHeight >= 760;
  const desktopBoost = isBrowserFullscreen ? 18 : isLargeViewport ? 10 : 0;
  const compactBoost = isCompactLayout ? 10 : 0;
  const tunedFieldCardSize = Math.min(
    236,
    Math.max(isCompactLayout ? 82 : 70, Math.round(92 * uiScale) + desktopBoost + compactBoost)
  );
  const benchCardSize = Math.min(
    isCompactLayout ? 210 : 198,
    Math.round(tunedFieldCardSize * (isCompactLayout ? 1.12 : 1.08))
  );
  const avatarRatio = isCompactLayout ? 0.44 : 0.52;
  const fieldAvatarSize = Math.round(tunedFieldCardSize * avatarRatio);
  const benchAvatarSize = Math.round(benchCardSize * avatarRatio);
  const nameFontSize = tunedFieldCardSize >= 128 ? 14 : tunedFieldCardSize >= 104 ? 13 : tunedFieldCardSize >= 84 ? 11 : 8;
  const nameLineClamp = tunedFieldCardSize >= 124 ? 3 : 2;
  const metaFontSize = tunedFieldCardSize >= 112 ? 12 : tunedFieldCardSize >= 88 ? 11 : 10;
  const isWideDesktop = !screenshotMode && responsiveWidth >= 1280;
  const adjustBaseLeft = (left: number) => {
    if (!isWideDesktop) return left;
    const delta = left - 50;
    const abs = Math.abs(delta);
    if (abs >= 26) return clampPercent(50 + delta * 0.86, 12, 88);
    if (abs >= 12) return clampPercent(50 + delta * 1.08, 8, 92);
    return left;
  };
  const adaptiveOffsetStep = Math.max(
    14,
    Math.min(38, Math.round(tunedFieldCardSize * 0.18) + (isCompactLayout ? 2 : 0))
  );
  const layoutGap = Math.round((isCompactLayout ? 26 : 22) * uiScale);
  const layoutPad = Math.round(16 * uiScale);
  const fieldHeight = screenshotMode
    ? Math.round(660 * uiScale)
    : Math.round(Math.max(540, Math.min(1040, viewportHeight * 0.83)));
  const fieldMinHeight = Math.round(Math.max(520, 520 * uiScale));
  const desktopFieldMinWidth = screenshotMode
    ? undefined
    : viewportWidth >= 1536
      ? "min(1480px, 72vw)"
      : viewportWidth >= 1280
        ? "min(1280px, 68vw)"
        : viewportWidth >= 1024
          ? "min(1080px, 64vw)"
          : undefined;
  const canShowFavoriteInCard = !screenshotMode;
  const layoutVars = {
    "--ui-scale": String(uiScale),
    "--field-card-size": `${tunedFieldCardSize}px`,
    "--bench-card-size": `${benchCardSize}px`,
    "--player-name-size": `${nameFontSize}px`,
    "--player-name-lines": String(nameLineClamp),
    "--player-meta-size": `${metaFontSize}px`,
    "--favorite-size": `${isCompactLayout ? 12 : 14}px`,
    "--layout-gap": `${layoutGap}px`,
    "--layout-pad": `${layoutPad}px`,
    "--field-height": `${fieldHeight}px`,
    "--field-min-height": `${fieldMinHeight}px`,
  } as CSSProperties;

  const renderBenchCard = (p: Player) => (
    <div
      key={p.id}
      className="player-card bench-player-card group"
      onClick={() => handleClick(p.id, true)}
    >
      {selectedId === p.id && (
        <>
          <span className="selected-ring absolute inset-0 pointer-events-none" />
          <span className="selected-aura absolute inset-0 pointer-events-none" />
          <span className="speedline absolute inset-0 pointer-events-none" />
        </>
      )}
      {tempoPulseId === p.id && (
        <span className="tempo-pulse absolute inset-0 pointer-events-none" />
      )}
      <div
        className="relative mx-auto"
        style={{ width: benchAvatarSize, height: benchAvatarSize }}
      >
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            width={benchAvatarSize}
            height={benchAvatarSize}
            className="w-full h-full object-cover rounded-full pointer-events-none"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300/40 rounded-full pointer-events-none text-center text-[10px] text-cyan-100">
            No image
          </div>
        )}
      </div>
      {/* player name (always visible) */}
      <div
        className="player-name-row font-semibold text-cyan-100"
        title={p.number ? `背番号: ${p.number}` : ""}
      >
        <span className="player-name">{p.name}</span>
      </div>
      {canShowFavoriteInCard &&
        (session ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
            className="favorite-overlay text-yellow-300"
            aria-label={favorites.has(p.id) ? "Remove from favorites" : "Add to favorites"}
          >
            {favorites.has(p.id) ? "★" : "☆"}
          </button>
        ) : (
          <Link
            href="/login"
            className="favorite-overlay text-yellow-300"
            aria-label="Login to favorite"
            onClick={(e) => {
              play();
              e.stopPropagation();
            }}
          >
            ☆
          </Link>
        ))}
      {/* jersey number */}
      {p.number && (
        <div className={`player-meta text-cyan-200 ${selectedId === p.id ? "block" : "hidden group-hover:block"}`}>
          背番号: {p.number}
        </div>
      )}
      {/* position info with wiki link */}
      <div className={`player-meta text-cyan-200 items-center gap-1 ${selectedId === p.id ? "flex justify-start" : "hidden group-hover:flex justify-start"}`}>
        <span>{p.position.join(", ")}</span>
        <WikiLink name={p.name} wikiUrl={p.wikiUrl} variant="icon" />
      </div>
    </div>
  );

  const screenshotHref = initialFormation?.id
    ? `/formations/screenshot?formationId=${initialFormation.id}`
    : "#";
  const displayFormationName =
    alias.trim() || initialFormation?.name || formation.name;

  return (
    <Profiler id="Formation" onRender={handleProfilerRender}>
      <div
        className="pb-8"
        style={{ ...layoutVars, padding: "var(--layout-pad)" }}
      >
      <h2 className="text-xl font-bold mb-4">Formation: {displayFormationName}</h2>
      <section className="mb-4 rounded-xl border border-cyan-300/20 bg-slate-950/35 p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs tracking-[0.14em] text-cyan-100/70">FORMATION CONTROLS</p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="mb-1 text-xs font-semibold tracking-wide text-cyan-100">Template</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {formations.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  className={`w-full px-3 py-1 border rounded text-sm sm:w-auto ${
                    formation.name === f.name ? "bg-green-300 text-slate-900" : ""
                  }`}
                  onClick={() => {
                    handleFormationChange(f);
                  }}
                >
                  {f.name}
                </button>
              ))}
              <button
                type="button"
                className="tap-action w-full px-3 py-1 border rounded text-sm sm:w-auto"
                onClick={() => {
                  play();
                  handleReset();
                }}
              >
                Reset
              </button>
              {initialFormation?.id && (
                <button
                  type="button"
                  className="tap-action w-full px-3 py-1 border rounded bg-cyan-600 text-white text-sm sm:w-auto"
                  onClick={() => {
                    play();
                    handleRestoreSaved();
                  }}
                >
                  保存状態に戻す
                </button>
              )}
            </div>
          </div>
          {!screenshotMode && (
            <div className="lg:col-span-5">
              <p className="mb-1 text-xs font-semibold tracking-wide text-cyan-100">Save</p>
              <div className="flex flex-col gap-2">
                {session ? (
                  <>
                    <input
                      type="text"
                      className="form-input w-full min-w-0"
                      placeholder="Formation name"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="tap-action px-4 py-2 bg-blue-500 text-white rounded w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isSaving ? (
                          <span className="flex items-center">
                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            保存中…
                          </span>
                        ) : (
                          initialFormation?.id ? "別名で保存" : "保存"
                        )}
                      </button>
                      {initialFormation?.id ? (
                        <button
                          type="button"
                          onClick={handleUpdate}
                          className="tap-action px-4 py-2 bg-green-600 text-white rounded w-full"
                        >
                          更新
                        </button>
                      ) : (
                        <Link
                          href={screenshotHref}
                          aria-disabled={!initialFormation?.id}
                          onClick={(e) => {
                            play();
                            if (!initialFormation?.id) {
                              e.preventDefault();
                              alert("Save the formation first");
                            }
                          }}
                          className={`tap-action px-4 py-2 bg-purple-500 text-white rounded text-center ${
                            !initialFormation?.id ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          Screenshot
                        </Link>
                      )}
                    </div>
                    {initialFormation?.id && (
                      <Link
                        href={screenshotHref}
                        aria-disabled={!initialFormation?.id}
                        onClick={(e) => {
                          play();
                          if (!initialFormation?.id) {
                            e.preventDefault();
                            alert("Save the formation first");
                          }
                        }}
                        className={`tap-action px-4 py-2 bg-purple-500 text-white rounded text-center ${
                          !initialFormation?.id ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        Screenshot
                      </Link>
                    )}
                  </>
                ) : (
                  <Link href="/login" className="underline w-full text-center">
                    Login to save
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      {!screenshotMode && (
        <section className="mb-4 rounded-xl border border-cyan-300/20 bg-slate-950/35 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs tracking-[0.14em] text-cyan-100/70">PLAYER FILTERS</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-cyan-200/30 px-2 py-1 text-[11px] text-cyan-100/80 hover:bg-cyan-300/10"
              onClick={() => setShowPlayerFilters((prev) => !prev)}
            >
              <span>{showPlayerFilters ? "Close" : "Open"}</span>
              <span
                className={`transition-transform duration-300 ${
                  showPlayerFilters ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
          </div>
          <p className="mt-1 text-[11px] text-cyan-100/70">
            {playerFilterActiveCount > 0 ? `${playerFilterActiveCount}件の条件を適用中` : ""}
          </p>
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: showPlayerFilters ? "560px" : "0px",
              opacity: showPlayerFilters ? 1 : 0,
              marginTop: showPlayerFilters ? "0.75rem" : "0rem",
            }}
          >
            <PlayerFilter
              rosters={rosters}
              positionOptions={positionOptions}
              onApply={setFilter}
            />
          </div>
        </section>
      )}
      <div
        id="field-bench"
        className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-center mt-8 sm:mt-12"
        style={{ gap: "var(--layout-gap)" }}
      >
      {/* field */}
      <div
        id="field"
        ref={fieldRef}
        className="field formation-field relative w-full sm:flex-1 sm:min-w-0 border border-cyan-400/10 rounded overflow-hidden"
        style={{
          height: "var(--field-height)",
          minHeight: "var(--field-min-height)",
          minWidth: desktopFieldMinWidth,
        }}
      >
        <div className="field-sweep absolute inset-0 pointer-events-none" />
        {sortedKeys.map((posKey) => {
          const base = formation.positions[posKey as keyof typeof formation.positions];
          if (!base) return null;

          /* --- slot fill: split into customs & defaults --- */
          const customs: Player[] = [];
          const defaults: Player[] = [];

          /* ① カスタム座標を持つ選手を先に収集 */
          lineupOrder.forEach((pid) => {
            if (customs.length >= base.max) return;
            if (drawn.has(pid)) return;
            if (playerPositions[pid]) {
              const pl = players.find((pp) => pp.id === pid);
              if (pl) {
                customs.push(pl);
                drawn.add(pid);
              }
            }
          });

          /* ② 残り枠をデフォルト順で収集 ─ customMode でも枠は保持 */
          while (
            customs.length + defaults.length < base.max &&
            orderIndex < lineupOrder.length
          ) {
            const pid = lineupOrder[orderIndex++];
            if (drawn.has(pid)) continue;
            const pl = players.find((pp) => pp.id === pid);
            if (pl) {
              defaults.push(pl);
              drawn.add(pid);
            }
          }

          const group = [...customs, ...defaults];

          return group.map((p) => {
            const defaultIndex = defaults.indexOf(p);
            const offset =
              defaultIndex !== -1
                ? ((defaultIndex - (defaults.length - 1) / 2) * adaptiveOffsetStep)
                : 0;
            const baseLeft = adjustBaseLeft(base.left);
            const def = {
              top: clampPercent(base.top),
              left: clampPercent(baseLeft + offset),
            };
            const customPos = playerPositions[p.id];
            const pos = customPos
              ? { top: clampPercent(customPos.top), left: clampPercent(customPos.left) }
              : def;

            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: frontmostId === p.id ? 10 : 0,
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  play();
                  e.preventDefault();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setDragging({
                    id: p.id,
                    offsetX: e.clientX - r.left - r.width / 2,
                    offsetY: e.clientY - r.top - r.height / 2,
                    pointerId: e.pointerId,
                  });
                  if (!customMode) freezeDefaults(
                    defaultsFrozen,
                    setDefaultsFrozen,
                    lineupOrder,
                    formation,
                    playerPositions,
                    setPlayerPositions,
                    adaptiveOffsetStep,
                    adjustBaseLeft
                  );
                  setCustomMode(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(p.id, false);
                }}
              >
                <div
                  className="player-card field-player-card group text-center"
                >
                  {selectedId === p.id && (
                    <>
                      <span className="selected-ring absolute inset-0 pointer-events-none" />
                      <span className="selected-aura absolute inset-0 pointer-events-none" />
                      <span className="speedline absolute inset-0 pointer-events-none" />
                    </>
                  )}
                  {tempoPulseId === p.id && (
                    <span className="tempo-pulse absolute inset-0 pointer-events-none" />
                  )}
                  <div
                    className="relative mx-auto"
                    style={{ width: fieldAvatarSize, height: fieldAvatarSize }}
                  >
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        width={fieldAvatarSize}
                        height={fieldAvatarSize}
                        className="w-full h-full object-cover rounded-full pointer-events-none"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300/40 rounded-full pointer-events-none text-center text-[10px] text-cyan-100">
                        No image
                      </div>
                    )}
                  </div>
                  {/* player name (always visible) */}
                  <div
                    className="player-name-row font-semibold text-cyan-100"
                    title={p.number ? `背番号: ${p.number}` : ""}
                  >
                    <span className="player-name">{p.name}</span>
                  </div>
                  {canShowFavoriteInCard &&
                    (session ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(p.id);
                        }}
                        className="favorite-overlay text-yellow-300"
                        aria-label={favorites.has(p.id) ? "Remove from favorites" : "Add to favorites"}
                      >
                        {favorites.has(p.id) ? "★" : "☆"}
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        className="favorite-overlay text-yellow-300"
                        aria-label="Login to favorite"
                        onClick={(e) => {
                          play();
                          e.stopPropagation();
                        }}
                      >
                        ☆
                      </Link>
                    ))}
                  {/* jersey number */}
                  {p.number && (
                    <div className={`player-meta text-cyan-200 ${selectedId === p.id ? "block" : "hidden group-hover:block"}`}>
                      背番号: {p.number}
                    </div>
                  )}
                  {/* position info with wiki link */}
                  <div className={`player-meta text-cyan-200 items-center gap-1 ${selectedId === p.id ? "flex justify-center" : "hidden group-hover:flex justify-center"}`}>
                    <span>{p.position.join(", ")}</span>
                    <WikiLink name={p.name} wikiUrl={p.wikiUrl} variant="icon" />
                  </div>
                </div>
              </div>
            );
          });
        })}
        </div>

        {/* bench */}
        <div id="bench" className="w-full sm:w-[calc(var(--bench-card-size,104px)*2+1rem)] shrink-0">
          {!screenshotMode && (
            <div className="mb-3 rounded-xl border border-cyan-200/25 bg-slate-950/45 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-[0.12em] text-cyan-100/80">
                  BENCH SIZE
                </p>
                <span className="text-xs text-cyan-100/75">
                  {effectiveBenchSize} / {MAX_BENCH_LIMIT}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={benchControlMax}
                  value={benchControlValue}
                  className="w-full accent-cyan-300"
                  onChange={(e) => setBenchSize(Number(e.target.value) || 0)}
                />
                <input
                  type="number"
                  min={0}
                  max={benchControlMax}
                  value={benchControlValue}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      setBenchSize(0);
                      e.currentTarget.value = "0";
                      return;
                    }
                    const parsed = Number(raw);
                    const next = Number.isFinite(parsed)
                      ? Math.max(0, Math.min(benchControlMax, Math.trunc(parsed)))
                      : 0;
                    setBenchSize(next);
                    const normalized = String(next);
                    if (e.currentTarget.value !== normalized) {
                      e.currentTarget.value = normalized;
                    }
                  }}
                  className="form-input h-9 w-20 text-center text-sm"
                  aria-label="Bench size"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(
                  new Set([7, 9, 12, benchControlMax].map((size) => Math.max(0, Math.min(size, benchControlMax))))
                ).map((safeSize) => {
                  return (
                    <button
                      key={`bench-size-${safeSize}`}
                      type="button"
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        safeSize === normalizedBenchSize
                          ? "border-cyan-200/70 bg-cyan-400/20 text-cyan-50"
                          : "border-cyan-200/30 text-cyan-100/80 hover:bg-cyan-300/10"
                      }`}
                      onClick={() => setBenchSize(safeSize)}
                    >
                      {safeSize}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <h3 className="text-lg font-bold mb-2">Bench ({benchPlayers.length})</h3>
          <div className="flex flex-wrap gap-0 sm:grid sm:grid-cols-2">
            {benchPlayers.map(renderBenchCard)}
          </div>
        </div>
      </div>

      {benchOutPlayersAll.length > 0 && (
        <div className="mt-8">
          {!screenshotMode && (
            <div className="mb-3 rounded-xl border border-cyan-200/25 bg-slate-950/45 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-[0.12em] text-cyan-100/80">
                  OFF BENCH FILTERS
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-200/30 px-2 py-1 text-[11px] text-cyan-100/80 hover:bg-cyan-300/10"
                    onClick={() => setShowOffBenchFilters((prev) => !prev)}
                  >
                    <span>{showOffBenchFilters ? "Close" : "Open"}</span>
                    <span
                      className={`transition-transform duration-300 ${
                        showOffBenchFilters ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-cyan-200/30 px-2 py-1 text-[11px] text-cyan-100/80 hover:bg-cyan-300/10"
                    onClick={() => {
                      setOffBenchNameFilter("");
                      setOffBenchPositionFilters([]);
                      setOffBenchLimit(DEFAULT_OFF_BENCH_LIMIT);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="mb-2 text-[11px] text-cyan-100/70">
                {offBenchFilterActiveCount > 0 ? `${offBenchFilterActiveCount}件の条件を適用中` : ""}
              </p>
              <div
                className="overflow-hidden transition-all duration-300 ease-out"
                style={{
                  maxHeight: showOffBenchFilters ? "520px" : "0px",
                  opacity: showOffBenchFilters ? 1 : 0,
                }}
              >
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold tracking-wide text-cyan-100">
                      Name
                    </label>
                    <input
                      type="text"
                      className="form-input w-full min-w-0"
                      placeholder="選手名で絞り込み"
                      value={offBenchNameFilter}
                      onChange={(e) => setOffBenchNameFilter(e.target.value)}
                    />
                  </div>
                  <MultiToggleGroup
                    className="lg:col-span-2"
                    legend={`Position (${offBenchPositionFilters.length})`}
                    options={offBenchPositionOptions.map((pos) => ({
                      value: pos,
                      label: pos,
                    }))}
                    selectedValues={offBenchPositionFilters}
                    onChange={setOffBenchPositionFilters}
                    emptyLabel="ポジションがありません"
                    wrapSelectedLabel
                    wrapOptionLabel
                  />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold tracking-wide text-cyan-100">
                      Off Bench人数
                    </label>
                    <span className="text-xs text-cyan-100/75">
                      {offBenchLimitValue} / {offBenchFilterMax}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={offBenchFilterMax}
                      value={offBenchLimitValue}
                      className="w-full accent-cyan-300"
                      onChange={(e) => setOffBenchLimit(Number(e.target.value) || 0)}
                    />
                    <input
                      type="number"
                      min={0}
                      max={offBenchFilterMax}
                      value={offBenchLimitValue}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          setOffBenchLimit(0);
                          e.currentTarget.value = "0";
                          return;
                        }
                        const parsed = Number(raw);
                        const next = Number.isFinite(parsed)
                          ? Math.max(0, Math.min(offBenchFilterMax, Math.trunc(parsed)))
                          : 0;
                        setOffBenchLimit(next);
                        const normalized = String(next);
                        if (e.currentTarget.value !== normalized) {
                          e.currentTarget.value = normalized;
                        }
                      }}
                      className="form-input h-9 w-20 text-center text-sm"
                      aria-label="Off bench size"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <h3 className="text-lg font-bold mb-2">Off Bench ({offBenchPlayers.length})</h3>
          <div className="flex flex-wrap gap-0">
            {offBenchPlayers.map(renderBenchCard)}
          </div>
        </div>
      )}

      </div>
    </Profiler>
  );
}
