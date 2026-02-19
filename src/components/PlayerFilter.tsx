import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { PositionKey, Roster } from "@/types/player";
import { rosterDisplayTitle } from "@/lib/format";
import type { PlayerFilterOptions } from "./Formation";
import useClickSound from "@/lib/useClickSound";
import MultiToggleGroup from "@/components/MultiToggleGroup";

interface Props {
  rosters: Roster[];
  positionOptions: PositionKey[];
  onApply: (filter: PlayerFilterOptions) => void;
}

export default function PlayerFilter({
  rosters,
  positionOptions,
  onApply,
}: Props) {
  const { data: session } = useSession();
  const [searchInput, setSearchInput] = useState("");
  const [rosterInputs, setRosterInputs] = useState<string[]>([]);
  const [positionInputs, setPositionInputs] = useState<string[]>([]);
  const [favoriteOnlyInput, setFavoriteOnlyInput] = useState(false);
  const previousUserIdRef = useRef<string | undefined>(undefined);
  const { play } = useClickSound();

  useEffect(() => {
    const prevId = previousUserIdRef.current;
    const currentId = session?.user?.id;
    if (prevId === currentId) return;
    if (prevId) {
      localStorage.removeItem(`selectedRoster_${prevId}`);
    }
    setSearchInput("");
    setRosterInputs([]);
    setPositionInputs([]);
    setFavoriteOnlyInput(false);
    onApply({});
    previousUserIdRef.current = currentId;
  }, [session?.user?.id, onApply]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const saved = localStorage.getItem(`selectedRoster_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRosterInputs(parsed.map((v) => String(v)));
          return;
        }
      } catch {
        // backward compatibility for old plain string
      }
      setRosterInputs([saved]);
    }
  }, [session, rosters]);

  useEffect(() => {
    if (rosterInputs.length === 0 || rosters.length === 0) return;
    const valid = rosterInputs.filter((id) =>
      rosters.some((r) => r.id === Number(id))
    );
    if (valid.length !== rosterInputs.length) {
      setRosterInputs(valid);
    }
  }, [rosterInputs, rosters]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (rosterInputs.length > 0) {
      localStorage.setItem(
        `selectedRoster_${userId}`,
        JSON.stringify(rosterInputs)
      );
    } else {
      localStorage.removeItem(`selectedRoster_${userId}`);
    }
  }, [rosterInputs, session]);

  const handleApply = () => {
    const rosterIds = rosterInputs
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    onApply({
      name: searchInput,
      rosterIds: rosterIds.length > 0 ? rosterIds : undefined,
      positions: positionInputs.length > 0 ? positionInputs : undefined,
      favoriteOnly: favoriteOnlyInput || undefined,
    });
  };

  const handleClear = () => {
    setSearchInput("");
    setRosterInputs([]);
    setPositionInputs([]);
    setFavoriteOnlyInput(false);
    onApply({});
  };

  return (
    <div className="mb-4 rounded-xl border border-cyan-300/20 bg-slate-950/35 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs tracking-[0.14em] text-cyan-100/70">
          PLAYER FILTERS
        </p>
        <p className="text-[11px] text-slate-300/70">4条件で絞り込み</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <label className="mb-1 block text-xs font-semibold tracking-wide text-cyan-100">
            Name
          </label>
          <input
            type="text"
            className="form-input w-full min-w-0"
            placeholder="選手名で絞り込み"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleApply();
              }
            }}
          />
        </div>
        <MultiToggleGroup
          className="xl:col-span-3"
          legend={`Roster (${rosterInputs.length})`}
          options={rosters.map((r) => ({
            value: String(r.id),
            label: rosterDisplayTitle(r),
          }))}
          selectedValues={rosterInputs}
          onChange={setRosterInputs}
          emptyLabel="ロースターがありません"
          wrapSelectedLabel
          wrapOptionLabel
        />
        <MultiToggleGroup
          className="xl:col-span-3"
          legend={`Position (${positionInputs.length})`}
          options={positionOptions.map((pos) => ({ value: pos, label: pos }))}
          selectedValues={positionInputs}
          onChange={setPositionInputs}
          emptyLabel="ポジションがありません"
        />
        <div className="xl:col-span-3">
          <label className="mb-1 block text-xs font-semibold tracking-wide text-cyan-100">
            Favorite
          </label>
          <label className="form-input flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              checked={favoriteOnlyInput}
              onChange={(e) => setFavoriteOnlyInput(e.target.checked)}
            />
            <span className="text-sm">お気に入りのみ表示</span>
          </label>
          <p className="mt-1 text-[11px] text-slate-300/70">
            ONで登録済みのお気に入りだけ表示
          </p>
        </div>
        <div className="md:col-span-2 xl:col-span-12 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
          <button
            className="ghost-btn w-full sm:w-auto"
            onClick={() => {
              play();
              handleClear();
            }}
          >
            クリア
          </button>
          <button
            className="primary-btn w-full sm:w-auto"
            onClick={() => {
              play();
              handleApply();
            }}
          >
            フィルターを適用
          </button>
        </div>
      </div>
    </div>
  );
}
