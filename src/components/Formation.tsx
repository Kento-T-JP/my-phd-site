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
import useClickSound from "@/lib/useClickSound";

export interface InitialFormation {
  id?: number;
  name: string;
  positions: {
    lineupOrder: number[];
    benchOrder: number[];
    playerPositions: Record<number, { top: number; left: number }>;
    baseFormationName?: string;
  };
}

export interface FormationState {
  lineupOrder: number[];
  benchOrder: number[];
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
const BENCH_LIMIT = 12;
const DEFAULT_FORMATION_NAME = "4-3-3";

export interface PlayerFilterOptions {
  name?: string;
  rosterId?: number;
  tournamentId?: number;
  position?: string;
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
  const pos = opts.position?.toLowerCase() ?? "";
  return list.filter((p) => {
    const matchName = !name || p.name.toLowerCase().includes(name);
    const matchRoster =
      opts.rosterId === undefined ||
      (p.rosterPlayers ?? []).some((rp) => rp.rosterId === opts.rosterId);
    const matchTournament =
      opts.tournamentId === undefined ||
      (p.rosterPlayers ?? []).some(
        (rp) => rp.roster?.tournamentId === opts.tournamentId
      );
    const matchPos =
      !pos || p.position.some((pp) => pp.toLowerCase().includes(pos));
    return matchName && matchRoster && matchTournament && matchPos;
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
  const [playerPositions, setPlayerPositions] = useState<
    Record<number, { top: number; left: number }>
  >(initialFormation?.positions.playerPositions ?? {});
  const [players, setPlayers] = useState<
    (Player & { rosterPlayers?: { rosterId: number; roster?: { tournamentId: number } }[] })[]
  >([]);
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
  const [alias, setAlias] = useState(initialFormation?.name ?? "");

  const [, startTransition] = useTransition();

  const [formationStates, setFormationStates] = useState<Record<string, FormationState>>(
    initialFormation
      ? {
          [initialFormation.name]: {
            lineupOrder: initialFormation.positions.lineupOrder ?? [],
            benchOrder: initialFormation.positions.benchOrder ?? [],
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
  const didRunFilterEffectRef = useRef(false);

  const positionOptions = useMemo(() => {
    const defaultPositions = formations.flatMap((f) =>
      Object.keys(f.positions)
    );
    const playerPositions = players.flatMap((p) => p.position);
    const rosterPositions = rosters.flatMap(
      (r) => r.players?.flatMap((rp) => rp.position ?? []) ?? []
    );
    return Array.from(
      new Set([
        ...defaultPositions,
        "DF",
        "MF/FW",
        ...playerPositions,
        ...rosterPositions,
      ])
    ) as PositionKey[];
  }, [players, rosters]);

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
    const base = resolveFormationTemplate(initialFormation, defaultFormation);
    setFormation(base);
    setLineupOrder(initialFormation.positions.lineupOrder ?? []);
    setBenchOrder(initialFormation.positions.benchOrder ?? []);
    setPlayerPositions(initialFormation.positions.playerPositions ?? {});
    setFormationStates((prev) => ({
      ...prev,
      [initialFormation.name]: {
        lineupOrder: initialFormation.positions.lineupOrder ?? [],
        benchOrder: initialFormation.positions.benchOrder ?? [],
        playerPositions: initialFormation.positions.playerPositions ?? {},
      },
    }));
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
    const update = () => {
      setFieldWidth(target.getBoundingClientRect().width);
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(target);
    document.addEventListener("fullscreenchange", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, [loading]);
  const filteredPlayers = useMemo(() => {
    return filterPlayers(players, filter);
  }, [players, filter]);

  let orderIndex = 0; // そのまま利用（変更不要）

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/players');
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
      filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id))
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
    // save current state for existing formation
    setFormationStates((prev) => ({
      ...prev,
      [formation.name]: { lineupOrder, benchOrder, playerPositions },
    }));

    const saved = formationStates[f.name];
    if (saved) {
      setLineupOrder(saved.lineupOrder);
      setBenchOrder(saved.benchOrder);
      setPlayerPositions(saved.playerPositions);
      const hasCustom = Object.keys(saved.playerPositions).length > 0;
      setCustomMode(hasCustom);
      setDefaultsFrozen(hasCustom);
    } else {
      const ids = makeInitialFieldIds(f, filteredPlayers);
      setLineupOrder(Array.from(ids));
      setBenchOrder(
        filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id))
      );
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
      benchOrder: filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id)),
      playerPositions: {},
    };
    setBenchOrder(newState.benchOrder);
    setLineupOrder(newState.lineupOrder);
    setPlayerPositions(newState.playerPositions);
    setFormationStates((prev) => ({ ...prev, [formation.name]: newState }));
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
    if (!didRunFilterEffectRef.current) {
      didRunFilterEffectRef.current = true;
      return;
    }
    handleReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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

  const playerBenchIds: number[] = [];
  const staffIds: number[] = [];
  benchOrder.forEach((id) => {
    const p = players.find((pl) => pl.id === id);
    const hasFieldPos =
      p?.position.some((pos) => BENCH_POSITION_ORDER.includes(pos)) ?? false;
    if (p?.role === "player" && hasFieldPos) {
      playerBenchIds.push(id);
    } else {
      staffIds.push(id);
    }
  });
  const benchIds = playerBenchIds.slice(0, BENCH_LIMIT);
  const benchOutIds = playerBenchIds.slice(BENCH_LIMIT).concat(staffIds);
  const getBenchSortPos = (p: Player) => {
    const pos = p.position;
    if (pos.includes("MF/FW") || pos.includes("MF") || pos.includes("FW")) {
      return "MF/FW";
    }
    return pos[0] ?? "";
  };
  const benchPlayers = benchIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => {
      const posA = getBenchSortPos(a);
      const posB = getBenchSortPos(b);
      const idxA = BENCH_POSITION_ORDER.indexOf(posA);
      const idxB = BENCH_POSITION_ORDER.indexOf(posB);
      if (idxA === -1 && idxB === -1) return posA.localeCompare(posB);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  const benchOutPlayers = benchOutIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => {
      const posA = getBenchSortPos(a);
      const posB = getBenchSortPos(b);
      const idxA = BENCH_POSITION_ORDER.indexOf(posA);
      const idxB = BENCH_POSITION_ORDER.indexOf(posB);
      if (idxA === -1 && idxB === -1) return posA.localeCompare(posB);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  const isCompactLayout = fieldWidth > 0 && fieldWidth < 640;
  const widthScale = fieldWidth > 0 ? fieldWidth / 980 : 1;
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
  const isWideDesktop = !screenshotMode && fieldWidth >= 1000;
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
      {!screenshotMode && (
        <PlayerFilter
          rosters={rosters}
          positionOptions={positionOptions}
          onApply={setFilter}
        />
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
          <h3 className="text-lg font-bold mb-2">Bench</h3>
          <div className="flex flex-wrap gap-0 sm:grid sm:grid-cols-2">
            {benchPlayers.map(renderBenchCard)}
          </div>
        </div>
      </div>

      {benchOutPlayers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-2">Off Bench</h3>
          <div className="flex flex-wrap gap-0">
            {benchOutPlayers.map(renderBenchCard)}
          </div>
        </div>
      )}

      {/* formation selector */}
      <div className="mt-4 space-x-2 flex flex-wrap">
        {formations.map((f) => (
          <button
            key={f.name}
            className={`px-3 py-1 border rounded ${
              formation.name === f.name ? "bg-green-300" : ""
            }`}
            onClick={() => {
              handleFormationChange(f);
            }}
          >
            {f.name}
          </button>
        ))}
        <button
          className="px-3 py-1 border rounded"
          onClick={() => {
            play();
            handleReset();
          }}
        >
          Reset
        </button>
      </div>

      {!screenshotMode && (
        <div className="z-10 bg-[#002D62] text-white p-4 flex flex-col sm:flex-row gap-2 items-center mb-8">
          {session ? (
            <>
              <input
                type="text"
                className="border p-2 flex-1 w-full text-white"
                placeholder="Formation name"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-500 text-white rounded w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
              {initialFormation?.id && (
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-green-600 text-white rounded w-full sm:w-auto"
                >
                  更新
                </button>
              )}
            </>
          ) : (
            <Link href="/login" className="underline w-full text-center">
              Login to save
            </Link>
          )}
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
            className={`px-4 py-2 bg-purple-500 text-white rounded w-full sm:w-auto ${
              !initialFormation?.id ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Screenshot
          </Link>
        </div>
      )}
      </div>
    </Profiler>
  );
}
