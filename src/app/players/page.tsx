"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import WikiLink from "@/components/WikiLink";
import type { Player, PositionKey, Tournament } from "@/types/player";
import type { FavoritePlayer } from "@/types/favorite";
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
  const { data: session } = useSession();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");

  const [searchInput, setSearchInput] = useState("");
  const [tournamentInput, setTournamentInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
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

  useEffect(() => {
    if (!session) return;
    async function loadFavorites() {
      try {
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const favs = (await res.json()) as FavoritePlayer[];
          setFavorites(new Set(favs.map((f) => f.player.id)));
        }
      } catch {
        // ignore errors
      }
    }
    loadFavorites();
  }, [session]);

  const filteredPlayers = useMemo(() => {
    const tournamentId = selectedTournament ? Number(selectedTournament) : undefined;
    return filterPlayers(players, {
      name: search,
      tournamentId,
      position: selectedPosition,
    });
  }, [players, search, selectedTournament, selectedPosition]);

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
          value={tournamentInput}
          onChange={(e) => setTournamentInput(e.target.value)}
        >
          <option value="">All tournaments</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
            setSelectedTournament(tournamentInput);
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
            <th className="border-b px-2 py-1 text-center">★</th>
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
              <td className="px-2 py-1 text-center">
                {session ? (
                  <button
                    onClick={() => toggleFavorite(p.id)}
                    className="text-yellow-300"
                    aria-label={favorites.has(p.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    {favorites.has(p.id) ? "★" : "☆"}
                  </button>
                ) : (
                  <Link href="/login" className="text-yellow-300" aria-label="Login to favorite">
                    ☆
                  </Link>
                )}
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
