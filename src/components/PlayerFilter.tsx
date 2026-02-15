import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { PositionKey, Roster } from "@/types/player";
import { rosterDisplayTitle } from "@/lib/format";
import type { PlayerFilterOptions } from "./Formation";
import useClickSound from "@/lib/useClickSound";

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
  const [rosterInput, setRosterInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
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
    setRosterInput("");
    setPositionInput("");
    onApply({});
    previousUserIdRef.current = currentId;
  }, [session?.user?.id, onApply]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const saved = localStorage.getItem(`selectedRoster_${userId}`);
    if (saved) {
      setRosterInput(saved);
    }
  }, [session, rosters]);

  useEffect(() => {
    if (!rosterInput || rosters.length === 0) return;
    const exists = rosters.some((r) => r.id === Number(rosterInput));
    if (!exists) {
      setRosterInput("");
    }
  }, [rosters, rosterInput]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (rosterInput) {
      localStorage.setItem(`selectedRoster_${userId}`, rosterInput);
    } else {
      localStorage.removeItem(`selectedRoster_${userId}`);
    }
  }, [rosterInput, session]);

  const handleApply = () => {
    const rosterId = rosterInput ? Number(rosterInput) : undefined;
    onApply({
      name: searchInput,
      rosterId,
      position: positionInput || undefined,
    });
  };

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="text"
        className="w-full min-w-0 border p-2"
        placeholder="Filter players..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <select
        className="w-full min-w-0 border p-2"
        value={rosterInput}
        onChange={(e) => setRosterInput(e.target.value)}
      >
        <option value="">全ての試合リスト</option>
        {rosters.map((r) => (
          <option key={r.id} value={r.id}>
            {rosterDisplayTitle(r)}
          </option>
        ))}
      </select>
      <select
        className="w-full min-w-0 border p-2"
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
        className="w-full px-3 py-2 bg-blue-500 text-white rounded sm:justify-self-end sm:w-auto"
        onClick={() => {
          play();
          handleApply();
        }}
      >
        Apply Filters
      </button>
    </div>
  );
}
