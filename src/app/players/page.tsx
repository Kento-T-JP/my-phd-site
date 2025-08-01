"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import WikiLink from "@/components/WikiLink";
import type { Player, PositionKey, Roster, Tournament } from "@/types/player";
import { formations } from "@/data/formations";
import BackButton from "@/components/BackButton";
import { filterPlayers } from "@/components/Formation";

const positionOptions: PositionKey[] = Array.from(
  new Set([
    ...formations.flatMap((f) => Object.keys(f.positions)),
    "DF",
    "MF/FW",
  ])
) as PositionKey[];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedRoster, setSelectedRoster] = useState<string>("");
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");

  const [searchInput, setSearchInput] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [subRosterInput, setSubRosterInput] = useState("");
  const [positionInput, setPositionInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/players");
        if (!res.ok) throw new Error("Failed to fetch players");
        setPlayers((await res.json()) as Player[]);
      } catch (err) {
        setError("Failed to load players");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function fetchRosters() {
      try {
        const res = await fetch("/api/rosters");
        if (!res.ok) throw new Error("Failed to fetch rosters");
        setRosters((await res.json()) as Roster[]);
      } catch (err) {
        console.error(err);
      }
    }
    fetchRosters();
  }, []);

  useEffect(() => {
    async function fetchTournaments() {
      try {
        const res = await fetch("/api/tournaments");
        if (!res.ok) throw new Error("Failed to fetch tournaments");
        setTournaments((await res.json()) as Tournament[]);
      } catch (err) {
        console.error(err);
      }
    }
    fetchTournaments();
    const handler = () => fetchTournaments();
    window.addEventListener("tournament-saved", handler);
    return () => window.removeEventListener("tournament-saved", handler);
  }, []);

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

  if (loading) {
    return (
      <main className="p-8">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-8">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">選手一覧を編集</h1>
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
            setFilterInput(e.target.value);
            setSubRosterInput("");
          }}
        >
          <option value="">All tournaments/rosters</option>
          {tournaments.map((t) => (
            <option key={`t-${t.id}`} value={`t:${t.id}`}>
              {t.name}
            </option>
          ))}
          {rosters.map((r) => (
            <option key={`r-${r.id}`} value={`r:${r.id}`}>
              {r.title}
            </option>
          ))}
        </select>
        {filterInput.startsWith("t:") && (
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
                  {r.title}
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
            if (filterInput.startsWith("r:")) {
              const rid = filterInput.slice(2);
              const r = rosters.find((ro) => ro.id === Number(rid));
              if (r) {
                setSelectedTournament(String(r.tournamentId));
              }
              setSelectedRoster(rid);
            } else if (filterInput.startsWith("t:")) {
              const tid = filterInput.slice(2);
              setSelectedTournament(tid);
              setSelectedRoster(subRosterInput);
            } else {
              setSelectedTournament("");
              setSelectedRoster("");
            }
          }}
        >
          Apply Filters
        </button>
      </div>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border-b px-2 py-1 text-left">背番号</th>
            <th className="border-b px-2 py-1 text-left">名前</th>
            <th className="border-b px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {filteredPlayers.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="px-2 py-1">{p.number ?? "-"}</td>
              <td className="px-2 py-1 text-white">
                <span className="flex items-center">
                  {p.name}
                  <WikiLink name={p.name} wikiUrl={p.wikiUrl} className="ml-1" />
                </span>
              </td>
              <td className="px-2 py-1 text-right">
                <Link href={`/players/${p.id}/edit`} className="text-yellow-300 underline">
                  編集
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
