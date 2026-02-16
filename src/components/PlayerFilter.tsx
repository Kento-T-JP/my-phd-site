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
  const [rosterInputs, setRosterInputs] = useState<string[]>([]);
  const [positionInputs, setPositionInputs] = useState<string[]>([]);
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
        multiple
        className="w-full min-w-0 border p-2"
        value={rosterInputs}
        onChange={(e) =>
          setRosterInputs(
            Array.from(e.target.selectedOptions).map((opt) => opt.value)
          )
        }
      >
        {rosters.map((r) => (
          <option key={r.id} value={r.id}>
            {rosterDisplayTitle(r)}
          </option>
        ))}
      </select>
      <select
        multiple
        className="w-full min-w-0 border p-2"
        value={positionInputs}
        onChange={(e) =>
          setPositionInputs(
            Array.from(e.target.selectedOptions).map((opt) => opt.value)
          )
        }
      >
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
