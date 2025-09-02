import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { PositionKey, Roster, Tournament } from "@/types/player";
import { rosterDisplayTitle } from "@/lib/format";
import type { PlayerFilterOptions } from "./Formation";

interface Props {
  rosters: Roster[];
  tournaments: Tournament[];
  positionOptions: PositionKey[];
  onApply: (filter: PlayerFilterOptions) => void;
}

export default function PlayerFilter({
  rosters,
  tournaments,
  positionOptions,
  onApply,
}: Props) {
  const { data: session } = useSession();
  const [searchInput, setSearchInput] = useState("");
  const [tournamentInput, setTournamentInput] = useState("");
  const [rosterInput, setRosterInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
  const previousUserIdRef = useRef<string | undefined>();

  useEffect(() => {
    const prevId = previousUserIdRef.current;
    const currentId = session?.user?.id;
    if (prevId === currentId) return;
    if (prevId) {
      localStorage.removeItem(`selectedRoster_${prevId}`);
    }
    setSearchInput("");
    setTournamentInput("");
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
      const r = rosters.find((rr) => rr.id === Number(saved));
      if (r) setTournamentInput(String(r.tournamentId));
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
    const tournamentId =
      rosterId === undefined && tournamentInput
        ? Number(tournamentInput)
        : undefined;
    onApply({
      name: searchInput,
      rosterId,
      tournamentId,
      position: positionInput || undefined,
    });
  };

  return (
    <div className="player-filter flex gap-2 mb-4">
      <input
        type="text"
        className="border p-1 flex-1"
        placeholder="Filter players..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <select
        className="border p-1"
        value={tournamentInput}
        onChange={(e) => {
          setTournamentInput(e.target.value);
          setRosterInput("");
        }}
      >
        <option value="">All tournaments</option>
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {tournamentInput && (
        <select
          className="border p-1"
          value={rosterInput}
          onChange={(e) => setRosterInput(e.target.value)}
        >
          <option value="">All rosters</option>
          {rosters
            .filter((r) => r.tournamentId === Number(tournamentInput))
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
        onClick={handleApply}
      >
        Apply Filters
      </button>
    </div>
  );
}

