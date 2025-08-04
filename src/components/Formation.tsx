"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import WikiLink from "@/components/WikiLink";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Player, PositionKey, Roster, Tournament } from "@/types/player";
import { rosterDisplayTitle } from "@/lib/format";
import { formations } from "@/data/formations";
import type { Formation } from "@/types/formation";

export interface InitialFormation {
  id?: number;
  name: string;
  positions: {
    lineupOrder: number[];
    benchOrder: number[];
    playerPositions: Record<number, { top: number; left: number }>;
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
}

/** horizontal spacing between players in the same line (percentage points) */
const OFFSET_STEP = 20; // wider than previous 16 to avoid overlap


/** 名前の長さに応じてクラスを返す */
const getNameClass = (name: string) => {
  const plainName = name.replace(/\s+/g, "");
  if (plainName.length >= 10) return "text-[10px] leading-tight";
  if (plainName.length >= 5) return "text-xs";
  return "";
};

const positionOptions: PositionKey[] = Array.from(
  new Set([
    ...formations.flatMap((f) => Object.keys(f.positions)),
    "DF",
    "MF/FW",
  ])
) as PositionKey[];

const BENCH_POSITION_ORDER = ["GK", "DF", "MF", "FW"];

export interface PlayerFilterOptions {
  name?: string;
  rosterId?: number;
  tournamentId?: number;
  position?: string;
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
  setPlayerPositions: React.Dispatch<React.SetStateAction<Record<number, { top: number; left: number }>>>
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
        const offset = (base.max > 1 ? (i - (base.max - 1) / 2) * OFFSET_STEP : 0);
        newPos[pid] = { top: base.top, left: base.left + offset };
      }
    }
  });

  setPlayerPositions((prev) => ({ ...newPos, ...prev }));
  setDefaultsFrozen(true);
};

export default function Formation({
  initialFormation,
  onSaved,
  onUpdated,
}: {
  initialFormation?: InitialFormation;
  onSaved?: () => void;
  onUpdated?: () => void;
}) {
  /* ───────── state ───────── */
  const base = initialFormation
    ? formations.find((f) => f.name === initialFormation.name) ?? formations[0]
    : formations[0];
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIsBench, setSelectedIsBench] = useState<boolean | null>(null);

  const [customMode, setCustomMode] = useState(false);  // false = 初期オート, true = ユーザー自由
  const [defaultsFrozen, setDefaultsFrozen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRoster, setSelectedRoster] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [subRosterInput, setSubRosterInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
  const [alias, setAlias] = useState(initialFormation?.name ?? "");

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
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const toggleFavorite = async (id: number) => {
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

  // update when a different formation is supplied from props
  useEffect(() => {
    if (!initialFormation) return;
    const base =
      formations.find((f) => f.name === initialFormation.name) ?? formations[0];
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
  }, [initialFormation]);

  // load roster options once
  useEffect(() => {
    async function fetchRosters() {
      try {
        const res = await fetch('/api/rosters');
        if (!res.ok) throw new Error('Failed to fetch rosters');
        const data: Roster[] = await res.json();
        setRosters(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchRosters();
  }, []);

  // load tournament options once
  useEffect(() => {
    async function fetchTournaments() {
      try {
        const res = await fetch('/api/tournaments');
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data: Tournament[] = await res.json();
        setTournaments(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchTournaments();
    const handler = () => fetchTournaments();
    window.addEventListener('tournament-saved', handler);
    return () => window.removeEventListener('tournament-saved', handler);
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
  }, [session]);

  // restore roster selection from localStorage once
  useEffect(() => {
    const saved = localStorage.getItem("selectedRoster");
    if (saved) setSelectedRoster(saved);
  }, []);

  // ensure stored roster still exists
  useEffect(() => {
    if (!selectedRoster || rosters.length === 0) return;
    const exists = rosters.some(r => r.id === Number(selectedRoster));
    if (!exists) {
      setSelectedRoster("");
    }
  }, [rosters, selectedRoster]);

  useEffect(() => {
    localStorage.setItem("selectedRoster", selectedRoster);
  }, [selectedRoster]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (selectedRoster) {
      setFilterInput(`r:${selectedRoster}`);
      setSubRosterInput('');
    } else if (selectedTournament) {
      setFilterInput(`t:${selectedTournament}`);
    } else {
      setFilterInput('');
      setSubRosterInput('');
    }
  }, [selectedRoster, selectedTournament]);

  useEffect(() => {
    setPositionInput(selectedPosition);
  }, [selectedPosition]);

  const filteredPlayers = useMemo(() => {
    const rosterId = selectedRoster ? Number(selectedRoster) : undefined;
    const tournamentId =
      rosterId === undefined && selectedTournament
        ? Number(selectedTournament)
        : undefined;
    return filterPlayers(players, {
      name: search,
      rosterId,
      tournamentId,
      position: selectedPosition,
    });
  }, [players, search, selectedRoster, selectedTournament, selectedPosition]);

  let orderIndex = 0; // そのまま利用（変更不要）

  // fetch players once
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch('/api/players');
        if (!res.ok) throw new Error('プレイヤー取得に失敗しました');
        const data: (Player & { rosterPlayers?: { rosterId: number }[] })[] = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error(err);
        setError('プレイヤーの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

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

    const move = (e: MouseEvent) => {
      if (!dragging) return;
      const field = document.querySelector(".field") as HTMLElement | null;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      nextLeft = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
      nextTop = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;
      scheduleUpdate();
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [dragging]);

  /* ───────── swap (bench ↔ field) ───────── */
  const handleClick = (id: number, isBench: boolean) => {
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
          const posA = prev[selectedId] ?? { ...prev[id] };
          const posB = prev[id] ?? { ...prev[selectedId] };
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
        arr[idx] = fieldId;   // 出て行く fieldId がベンチ側へ
      }
      return arr;
    });

    setLineupOrder((prev) => prev.map((x) => (x === fieldId ? benchId : x)));

    // pos swap (bench gets field coord, field coord removed)
    setPlayerPositions((prev) => {
      const fieldPos = prev[fieldId] ?? { top: 50, left: 50 };
      const copy = { ...prev };
      copy[benchId] = fieldPos;
      delete copy[fieldId];
      return copy;
    });

    if (!customMode) freezeDefaults(defaultsFrozen, setDefaultsFrozen, lineupOrder, formation, playerPositions, setPlayerPositions);
    setCustomMode(true);

    setSelectedId(null);
    setSelectedIsBench(null);
  };

  const handleFormationChange = (f: Formation) => {
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
    if (!session) {
      alert("Please log in to save your formation.");
      return;
    }
    const name = alias.trim() || formation.name;
    if (!window.confirm('Save formation "' + name + '"?')) {
      return;
    }
    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          positions: { lineupOrder, benchOrder, playerPositions },
        }),
      });
      if (res.ok) {
        alert("保存しました");
        onSaved?.();
      } else {
        const data = await res.json();
        alert(data.error || "保存に失敗しました");
      }
    } catch (err) {
      alert("保存に失敗しました");
    }
  };

  const handleUpdate = async () => {
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
          positions: { lineupOrder, benchOrder, playerPositions },
        }),
      });
      if (res.ok) {
        alert("更新しました");
        onUpdated?.();
      } else {
        const data = await res.json();
        alert(data.error || "更新に失敗しました");
      }
    } catch (err) {
      alert("更新に失敗しました");
    }
  };

  useEffect(() => {
    handleReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedRoster, selectedPosition]);

  /* ───────── render helpers ───────── */
  // track which IDs have already been drawn this frame
  const drawn = new Set<number>();

  const sortedKeys = Object.keys(formation.positions);

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  const benchList = benchOrder.map((id) => players.find((p) => p.id === id));
  const benchPlayers = benchList
    .filter((p): p is Player => p?.role === "player")
    .sort((a, b) => {
      const posA = a.position[0] ?? "";
      const posB = b.position[0] ?? "";
      const idxA = BENCH_POSITION_ORDER.indexOf(posA as any);
      const idxB = BENCH_POSITION_ORDER.indexOf(posB as any);
      if (idxA === -1 && idxB === -1) return posA.localeCompare(posB);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  const staff = benchList.filter((p): p is Player => p?.role === "staff");

  const renderBenchCard = (p: Player) => (
    <div
      key={p.id}
      className={`player-card relative w-32 max-w-32 max-h-32 p-2 border rounded cursor-pointer group transition-transform duration-200 hover:scale-105 backdrop-blur-sm border-cyan-400/10 hover:border-cyan-400/20 bg-slate-800/50`}
      onClick={() => handleClick(p.id, true)}
    >
      {selectedId === p.id && (
        <span className="orbit-dot absolute inset-0 pointer-events-none" />
      )}
      <div className="relative w-12 h-12 mx-auto">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            width={48}
            height={48}
            className="w-12 h-12 object-cover rounded-full pointer-events-none"
          />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center bg-gray-300/40 rounded-full pointer-events-none text-center text-xs text-cyan-100">
            No image
          </div>
        )}
      </div>
      {/* player name (always visible) */}
      <div
        className={`font-semibold whitespace-normal break-words text-cyan-100 flex items-center justify-center`}
        title={p.number ? `背番号: ${p.number}` : ""}
      >
        <span className={getNameClass(p.name)}>{p.name}</span>
        {session ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
            className="ml-1 text-yellow-300"
            aria-label={favorites.has(p.id) ? "Remove from favorites" : "Add to favorites"}
          >
            {favorites.has(p.id) ? "★" : "☆"}
          </button>
        ) : (
          <Link
            href="/login"
            className="ml-1 text-yellow-300"
            aria-label="Login to favorite"
            onClick={(e) => e.stopPropagation()}
          >
            ☆
          </Link>
        )}
      </div>
      {/* jersey number */}
      {p.number && (
        <div className="text-sm text-cyan-200 hidden group-hover:block">
          背番号: {p.number}
        </div>
      )}
      {/* position info with wiki link */}
      <div className="text-sm text-cyan-200 hidden group-hover:flex items-center justify-start gap-1">
        <span>{p.position.join(", ")}</span>
        <WikiLink name={p.name} wikiUrl={p.wikiUrl} variant="icon" />
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Formation: {formation.name}</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="border p-1 flex-1"
          placeholder="Filter players..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="border p-1"
          value={filterInput}
          onChange={(e) => {
            const val = e.target.value;
            setFilterInput(val);
            setSubRosterInput('');
          }}
        >
          <option value="">All tournaments</option>
          {tournaments.map((t) => (
            <option key={`t-${t.id}`} value={`t:${t.id}`}> {t.name} </option>
          ))}
        </select>
        {filterInput.startsWith('t:') && (
          <select
            className="border p-1"
            value={subRosterInput}
            onChange={(e) => setSubRosterInput(e.target.value)}
          >
            <option value="">All rosters</option>
            {rosters
              .filter((r) => r.tournamentId === Number(filterInput.slice(2)))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {rosterDisplayTitle(r)}
                </option>
              ))}
          </select>
        )}
        <select
          className="border p-1"
          value={positionInput}
          onChange={(e) => setPositionInput(e.target.value)}
        >
          <option value="">All positions</option>
          {positionOptions.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <button
          className="px-2 py-1 bg-blue-500 text-white rounded"
          onClick={() => {
            setSearch(searchInput);
            setSelectedPosition(positionInput);
            if (filterInput.startsWith('t:')) {
              const tid = filterInput.slice(2);
              setSelectedTournament(tid);
              setSelectedRoster(subRosterInput);
            } else {
              setSelectedTournament('');
              setSelectedRoster('');
            }
          }}
        >
          Apply Filters
        </button>
      </div>

      {/* field */}
      <div className="field formation-field relative w-full h-[600px] border border-cyan-400/10 rounded overflow-hidden">
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
            const offset =
              defaults.includes(p)
                ? ((defaults.indexOf(p) - (defaults.length - 1) / 2) * OFFSET_STEP)
                : 0;
            const def = { top: base.top, left: base.left + offset };
            const pos = playerPositions[p.id] ?? def;

            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseDown={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setDragging({
                    id: p.id,
                    offsetX: e.clientX - r.left - r.width / 2,
                    offsetY: e.clientY - r.top - r.height / 2,
                  });
                  if (!customMode) freezeDefaults(defaultsFrozen, setDefaultsFrozen, lineupOrder, formation, playerPositions, setPlayerPositions);
                  setCustomMode(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(p.id, false);
                }}
              >
                <div
                  className={`player-card relative group w-32 max-w-32 max-h-32 p-2 rounded text-center cursor-pointer transition-transform duration-200 hover:scale-105 backdrop-blur-sm border border-cyan-400/10 hover:border-cyan-400/20 bg-slate-800/50`}
                >
                  {selectedId === p.id && (
                    <span className="orbit-dot absolute inset-0 pointer-events-none" />
                  )}
                  <div className="relative w-12 h-12 mx-auto">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-full pointer-events-none"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-300/40 rounded-full pointer-events-none text-center text-xs text-cyan-100">
                        No image
                      </div>
                    )}
                  </div>
                  {/* player name (always visible) */}
                  <div
                    className={`font-semibold whitespace-normal break-words text-cyan-100 flex items-center justify-center`}
                    title={p.number ? `背番号: ${p.number}` : ""}
                  >
                    <span className={getNameClass(p.name)}>{p.name}</span>
                    {session ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(p.id);
                        }}
                        className="ml-1 text-yellow-300"
                        aria-label={favorites.has(p.id) ? "Remove from favorites" : "Add to favorites"}
                      >
                        {favorites.has(p.id) ? "★" : "☆"}
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        className="ml-1 text-yellow-300"
                        aria-label="Login to favorite"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ☆
                      </Link>
                    )}
                  </div>
                  {/* jersey number */}
                  {p.number && (
                    <div className="text-sm text-cyan-200 hidden group-hover:block">
                      背番号: {p.number}
                    </div>
                  )}
                  {/* position info with wiki link */}
                  <div className="text-sm text-cyan-200 hidden group-hover:flex items-center justify-center gap-1">
                    <span>{p.position.join(", ")}</span>
                    <WikiLink name={p.name} wikiUrl={p.wikiUrl} variant="icon" />
                  </div>
                </div>
              </div>
            );
          });
        })}
      </div>

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
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      {/* bench */}
      <div className="mt-8">
        <h3 className="text-lg font-bold mb-2">Bench</h3>
        <div className="flex flex-wrap gap-2">
          {benchPlayers.map(renderBenchCard)}
          {staff.map(renderBenchCard)}
        </div>
      </div>

      <div className="mt-4 flex gap-2 items-center">
        {session ? (
          <>
            <input
              type="text"
              className="border p-1 flex-1"
              placeholder="Formation name"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Save
            </button>
            {initialFormation?.id && (
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Update
              </button>
            )}
          </>
        ) : (
          <Link href="/login" className="underline">
            Login to save
          </Link>
        )}
      </div>
    </div>
  );
}