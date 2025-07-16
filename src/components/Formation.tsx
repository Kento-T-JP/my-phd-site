"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Player } from "@/types/player";
import { formations } from "@/data/formations";
import type { Formation } from "@/types/formation";

interface Dragging {
  id: number;
  offsetX: number;
  offsetY: number;
}

/** horizontal spacing between players in the same line (percentage points) */
const OFFSET_STEP = 20; // wider than previous 16 to avoid overlap

/** 5 文字以上を “長い名前” とみなしてフォント縮小 */
const isLongName = (name: string) => name.replace(/\s+/g, "").length >= 5;

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

export default function Formation() {
  /* ───────── state ───────── */
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [formation, setFormation] = useState<Formation>(formations[0]);
  const [lineupOrder, setLineupOrder] = useState<number[]>([]);
  const [benchOrder, setBenchOrder] = useState<number[]>([]);
  const [playerPositions, setPlayerPositions] = useState<Record<number, { top: number; left: number }>>({});
  const [dragging, setDragging] = useState<Dragging | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIsBench, setSelectedIsBench] = useState<boolean | null>(null);

  const [customMode, setCustomMode] = useState(false);  // false = 初期オート, true = ユーザー自由
  const [defaultsFrozen, setDefaultsFrozen] = useState(false);

  let orderIndex = 0; // そのまま利用（変更不要）

  // fetch players once
  useEffect(() => {
    fetch('/api/players')
      .then((res) => res.json())
      .then((data: Player[]) => {
        setPlayers(data);
      });
  }, []);

  // initialize ids when players or formation change
  useEffect(() => {
    if (players.length === 0) return;
    const ids = makeInitialFieldIds(formation, players);
    setBenchOrder(players.map((p) => p.id).filter((id) => !ids.has(id)));
    setLineupOrder(Array.from(ids));
    setLoading(false);
  }, [players, formation]);

  /* ───────── drag handler ───────── */
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging) return;
      const field = document.querySelector(".field") as HTMLElement | null;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const left = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
      const top = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;

      setPlayerPositions((prev) => {
        const prevPos = prev[dragging.id];
        // 位置がほぼ変わらない（0.2% 未満）の場合は更新しない
        if (prevPos && Math.abs(prevPos.left - left) < 0.2 && Math.abs(prevPos.top - top) < 0.2) {
          return prev;              // 変化が小さい → そのまま
        }
        return { ...prev, [dragging.id]: { top, left } };
      });
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
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

  /* ───────── render helpers ───────── */
  // track which IDs have already been drawn this frame
  const drawn = new Set<number>();

  const sortedKeys = Object.keys(formation.positions);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Formation: {formation.name}</h2>

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
                  className={`font-semibold whitespace-normal break-words ${
                    isLongName(p.name) ? "text-xs leading-tight" : ""
                  }`}
                  title={p.number ? `背番号: ${p.number}` : ""}
                >
                  {p.name}
                </div>
                {/* jersey number appears on hover, just like the position */}
                {p.number && (
                  <div className="text-sm hidden group-hover:block">背番号: {p.number}</div>
                )}
                {/* position stays as‑is */}
                <div className="text-sm hidden group-hover:block">
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
              const ids = makeInitialFieldIds(f, players);
              setFormation(f);
              setBenchOrder(players.map((p) => p.id).filter((id) => !ids.has(id)));
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
                  className={`font-semibold whitespace-normal break-words ${
                    isLongName(p.name) ? "text-xs leading-tight" : ""
                  }`}
                  title={p.number ? `背番号: ${p.number}` : ""}
                >
                  {p.name}
                </div>
                {/* jersey number appears on hover */}
                {p.number && (
                  <div className="text-sm hidden group-hover:block">背番号: {p.number}</div>
                )}
                {/* position info */}
                <div className="text-sm hidden group-hover:block">
                  {p.position.join(", ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}