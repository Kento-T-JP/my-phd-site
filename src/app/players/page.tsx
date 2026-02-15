"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSession, getCsrfToken } from "next-auth/react";
import { useRouter } from "next/navigation";
import WikiLink from "@/components/WikiLink";
import type { Player, PositionKey, Roster } from "@/types/player";
import { formations } from "@/data/formations";
import BackButton from "@/components/BackButton";
import { filterPlayers } from "@/components/Formation";
import { rosterDisplayTitle } from "@/lib/format";
import LoadingSpinner from "@/components/LoadingSpinner";
import useClickSound from "@/lib/useClickSound";

export default function PlayersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedRoster, setSelectedRoster] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");

  const [searchInput, setSearchInput] = useState("");
  const [rosterInput, setRosterInput] = useState("");
  const [positionInput, setPositionInput] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [csrf, setCsrf] = useState("");
  const previousUserIdRef = useRef<string | undefined>();
  const deleteAudioRef = useRef<HTMLAudioElement | null>(null);
  const { play } = useClickSound();

  useEffect(() => {
    if (typeof window !== "undefined" && !deleteAudioRef.current) {
      const audio = new Audio("/sounds/hitonokokoro.mp3");
      audio.preload = "auto";
      deleteAudioRef.current = audio;
    }
  }, []);

  const playDeleteSound = () => {
    const audio = deleteAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch {
      // ignore play errors
    }
  };

  useEffect(() => {
    const prevId = previousUserIdRef.current;
    const currentId = session?.user?.id;
    if (prevId === currentId) return;

    if (prevId) {
      localStorage.removeItem(`selectedRoster_${prevId}`);
    }
    localStorage.removeItem("selectedRoster");

    setPlayers([]);
    setRosters([]);
    setFavorites(new Set());
    setError("");
    setLoading(true);
    setSearch("");
    setSelectedRoster("");
    setSelectedPosition("");
    setSearchInput("");
    setRosterInput("");
    setPositionInput("");

    previousUserIdRef.current = currentId;
  }, [session?.user?.id]);

  const positionOptions = useMemo(() => {
    const defaultPositions = formations.flatMap((f) =>
      Object.keys(f.positions)
    );
    const playerPositions = players.flatMap((p) => p.position);
    return Array.from(
      new Set([...defaultPositions, "DF", "MF/FW", ...playerPositions])
    ) as PositionKey[];
  }, [players]);

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
    if (!session) return;
    async function load() {
      try {
        const res = await fetch("/api/players");
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = (await res.json()) as Player[];
        // API から返却されたセッションユーザーの結果をそのまま利用しつつ、
        // もし万が一 isDeleted フラグが付いている場合は除外する
        setPlayers(data.filter((p) => !p.isDeleted));
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to load players"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  useEffect(() => {
    getCsrfToken().then((token) => setCsrf(token ?? ""));
  }, []);

  useEffect(() => {
    if (!session) return;
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
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadFavorites() {
      try {
        const res = await fetch("/api/favorites");
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

  const filteredPlayers = useMemo(() => {
    const rosterId = selectedRoster ? Number(selectedRoster) : undefined;
    return filterPlayers(players, {
      name: search,
      rosterId,
      position: selectedPosition,
    }).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [players, search, selectedRoster, selectedPosition]);

  const allSelected =
    filteredPlayers.length > 0 &&
    filteredPlayers.every((p) => selectedIds.has(p.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (allSelected) {
        filteredPlayers.forEach((p) => s.delete(p.id));
      } else {
        filteredPlayers.forEach((p) => s.add(p.id));
      }
      return s;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm("選択した選手を削除しますか？")) return;
    const ids = Array.from(selectedIds);
    const deleted: number[] = [];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/players/${id}`, {
          method: "DELETE",
          headers: { "X-CSRF-Token": csrf },
        });
        if (res.ok) {
          deleted.push(id);
        } else {
          throw new Error("Failed to delete");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to delete selected players");
        break;
      }
    }
    if (deleted.length > 0) {
      setPlayers((prev) => prev.filter((p) => !deleted.includes(p.id)));
      playDeleteSound();
    }
    setSelectedIds(new Set());
  };

  if (status === "loading") return <LoadingSpinner />;
  if (!session) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <main className="p-4 sm:p-8">
        <LoadingSpinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 sm:p-8">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-4">選手一覧を編集</h1>
      <div className="mb-2">
        <button
          className="px-2 py-1 bg-red-500 text-white rounded disabled:opacity-50"
          disabled={selectedIds.size === 0}
          onClick={handleDeleteSelected}
        >
          Delete selected
        </button>
      </div>
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
            play();
            setSearch(searchInput);
            setSelectedPosition(positionInput);
            setSelectedRoster(rosterInput);
          }}
        >
          Apply Filters
        </button>
      </div>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border-b px-2 py-1 text-center">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
            </th>
            <th className="border-b px-2 py-1 text-left">背番号</th>
            <th className="border-b px-2 py-1 text-left">名前</th>
            <th className="border-b px-2 py-1 text-center">★</th>
            <th className="border-b px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {filteredPlayers.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="px-2 py-1 text-center">
                <input
                  type="checkbox"
                  aria-label={`Select player ${p.id}`}
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                />
              </td>
              <td className="px-2 py-1">{p.number ?? "-"}</td>
              <td className="px-2 py-1 text-white">
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  <WikiLink
                    name={p.name}
                    wikiUrl={p.wikiUrl}
                    className="ml-2"
                  />
                </div>
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
                {session ? (
                  <Link
                    href={`/players/${p.id}/edit`}
                    className="text-yellow-300 underline"
                  >
                    {p.userId === session.user.id ? "編集" : "カスタム作成"}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="text-yellow-300 underline"
                  >
                    編集
                  </Link>
                )}
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
