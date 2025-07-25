"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Player } from "@/types/player";
import { formations } from "@/data/formations";
import type { Formation } from "@/types/formation";

export interface InitialFormation {
  name: string;
  positions: {
    lineupOrder: number[];
    benchOrder: number[];
    playerPositions: Record<number, { top: number; left: number }>;
  };
}

interface Dragging {
  id: number;
  offsetX: number;
  offsetY: number;
}

/** horizontal spacing between players in the same line (percentage points) */
const OFFSET_STEP = 20; // wider than previous 16 to avoid overlap

/** 5 文字以上を “長い名前” とみなしてフォント縮小 */
const isLongName = (name: string) => name.replace(/\s+/g, "").length >= 5;

export function filterPlayers<T extends Player & { rosterPlayers?: { rosterId: number }[] }>(
  list: T[],
  search: string,
  rosterId?: number
): T[] {
  const s = search.toLowerCase();
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(s) &&
      (rosterId === undefined || (p.rosterPlayers ?? []).some(rp => rp.rosterId === rosterId))
  );
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
}: {
  initialFormation?: InitialFormation;
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
    (Player & { rosterPlayers?: { rosterId: number }[] })[]
  >([]);
  const [rosters, setRosters] = useState<{ id: number; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIsBench, setSelectedIsBench] = useState<boolean | null>(null);

  const [customMode, setCustomMode] = useState(false);  // false = 初期オート, true = ユーザー自由
  const [defaultsFrozen, setDefaultsFrozen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRoster, setSelectedRoster] = useState<string>("");

  const { data: session } = useSession();

  // load roster options once
  useEffect(() => {
    async function fetchRosters() {
      try {
        const res = await fetch('/api/rosters/titles');
        if (!res.ok) throw new Error('Failed to fetch rosters');
        const data: { id: number; title: string }[] = await res.json();
        setRosters(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchRosters();
  }, []);

  // restore roster selection from localStorage once
  useEffect(() => {
    const saved = localStorage.getItem("selectedRoster");
    if (saved) setSelectedRoster(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedRoster", selectedRoster);
  }, [selectedRoster]);

  const filteredPlayers = useMemo(
    () => filterPlayers(players, search, selectedRoster ? Number(selectedRoster) : undefined),
    [players, search, selectedRoster]
  );

  let orderIndex = 0; // そのまま利用（変更不要）

  // fetch players once
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch('/api/players');
        if (!res.ok) throw new Error('Failed to fetch players');
        const data: (Player & { rosterPlayers?: { rosterId: number }[] })[] = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load players');
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

  const handleSave = async () => {
    if (!session) {
      alert("Please log in to save your formation.");
      return;
    }
    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formation.name,
          positions: { lineupOrder, benchOrder, playerPositions },
        }),
      });
      if (res.ok) {
        alert("Saved!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save");
      }
    } catch (err) {
      alert("Failed to save");
    }
  };

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

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Formation: {formation.name}</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="border p-1 flex-1"
          placeholder="Filter players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border p-1"
          value={selectedRoster}
          onChange={(e) => setSelectedRoster(e.target.value)}
        >
          <option value="">All rosters</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>

      {/* field */}
      <div className="field relative w-full h-[600px] border bg-green-700 rounded overflow-hidden">
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
                className={`absolute group w-32 max-w-32 max-h-32 p-2 rounded text-center cursor-pointer transition-transform duration-200 hover:scale-105 ${
                  selectedId === p.id ? "bg-blue-200" : "bg-white"
                }`}
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
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 object-cover rounded-full mx-auto pointer-events-none"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-300 rounded-full mx-auto pointer-events-none text-center text-xs">
                    No image
                  </div>
                )}
                {/* player name (always visible) */}
                <div
                  className={`font-semibold whitespace-normal break-words text-black ${
                    isLongName(p.name) ? "text-xs leading-tight" : ""
                  }`}
                  title={p.number ? `背番号: ${p.number}` : ""}
                >
                  {p.name}
                </div>
                {/* jersey number appears on hover, just like the position */}
                {p.number && (
                  <div className="text-sm text-black hidden group-hover:block">背番号: {p.number}</div>
                )}
                {/* position stays as‑is */}
                <div className="text-sm text-black hidden group-hover:block">
                  {p.position.join(", ")}
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
              const ids = makeInitialFieldIds(f, filteredPlayers);
              setFormation(f);
              setBenchOrder(
                filteredPlayers.map((p) => p.id).filter((id) => !ids.has(id))
              );
              setLineupOrder(Array.from(ids));
              setCustomMode(false);
              setDefaultsFrozen(false);
              setPlayerPositions({});
              setSelectedId(null);
            }}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* bench */}
      <div className="mt-8">
        <h3 className="text-lg font-bold mb-2">Bench</h3>
        <div className="flex flex-wrap gap-2">
          {benchOrder.map((bid) => {
            const p = players.find((pl) => pl.id === bid);
            if (!p) return null;
            return (
              <div
                key={p.id}
                className={`w-32 max-w-32 max-h-32 p-2 border rounded cursor-pointer group transition-transform duration-200 hover:scale-105 ${
                  selectedId === p.id ? "bg-blue-200" : "bg-gray-200"
                }`}
                onClick={() => handleClick(p.id, true)}
              >
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 object-cover rounded-full mx-auto pointer-events-none"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-300 rounded-full mx-auto pointer-events-none text-center text-xs">
                    No image
                  </div>
                )}
                {/* player name (always visible) */}
                <div
                  className={`font-semibold whitespace-normal break-words text-black ${
                    isLongName(p.name) ? "text-xs leading-tight" : ""
                  }`}
                  title={p.number ? `背番号: ${p.number}` : ""}
                >
                  {p.name}
                </div>
                {/* jersey number appears on hover */}
                {p.number && (
                  <div className="text-sm text-black hidden group-hover:block">背番号: {p.number}</div>
                )}
                {/* position info */}
                <div className="text-sm text-black hidden group-hover:block">
                  {p.position.join(", ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {session ? (
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Save
          </button>
        ) : (
          <Link href="/login" className="underline">
            Login to save
          </Link>
        )}
      </div>
    </div>
  );
}