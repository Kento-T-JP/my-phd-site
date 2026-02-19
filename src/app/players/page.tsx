"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession, getCsrfToken } from "next-auth/react";
import { useRouter } from "next/navigation";
import WikiLink from "@/components/WikiLink";
import type { Player, PositionKey, Roster } from "@/types/player";
import BackButton from "@/components/BackButton";
import { rosterDisplayTitle } from "@/lib/format";
import LoadingSpinner from "@/components/LoadingSpinner";
import useClickSound from "@/lib/useClickSound";
import MultiToggleGroup from "@/components/MultiToggleGroup";
import { getDefaultPositions } from "@/lib/defaultPositions";

type PlayersPageProps = {
  getCsrfTokenFn?: typeof getCsrfToken;
};
type PagedPlayersResponse = {
  players: Player[];
  total: number;
  page: number;
  pageSize: number;
};

const positionOrder = ["GK", "DF", "MF", "FW"] as const;

function getPrimaryPosition(positions: string[]): string {
  for (const key of positionOrder) {
    if (positions.some((p) => p.includes(key))) return key;
  }
  return positions[0] ?? "";
}

function getPositionRank(positions: string[]): number {
  const primary = getPrimaryPosition(positions);
  const idx = positionOrder.indexOf(primary as (typeof positionOrder)[number]);
  return idx === -1 ? positionOrder.length : idx;
}

export default function PlayersPage({
  getCsrfTokenFn = getCsrfToken,
}: PlayersPageProps = {}) {
  const { data: session, status } = useSession();
  const sessionUserIdKey = session?.user?.id ?? "";
  const sessionUserId = session?.user?.id ? Number(session.user.id) : NaN;
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [managedPositions, setManagedPositions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(200);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [rosterInputs, setRosterInputs] = useState<string[]>([]);
  const [positionInputs, setPositionInputs] = useState<string[]>([]);
  const [favoriteOnlyInput, setFavoriteOnlyInput] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteProgress, setDeleteProgress] = useState<{
    total: number;
    done: number;
  } | null>(null);
  const [csrf, setCsrf] = useState("");
  const previousUserIdRef = useRef<string | undefined>(undefined);
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
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    try {
      if (localStorage.getItem("mute") === "true") return;
    } catch {
      return;
    }
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
    setSelectedRosterIds([]);
    setSelectedPositions([]);
    setPage(1);
    setTotalPlayers(0);
    setSearchInput("");
    setRosterInputs([]);
    setPositionInputs([]);
    setFavoriteOnlyInput(false);
    setFavoriteOnly(false);

    previousUserIdRef.current = currentId;
  }, [session?.user?.id]);

  const positionOptions = useMemo(() => {
    const defaultPositions = getDefaultPositions();
    const playerPositions = players.flatMap((p) => p.position);
    return Array.from(
      new Set([
        ...defaultPositions,
        "DF",
        "MF/FW",
        ...managedPositions,
        ...playerPositions,
      ])
    ) as PositionKey[];
  }, [managedPositions, players]);

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

  const loadPlayers = useCallback(
    async (opts?: { resetPage?: boolean }) => {
      if (!sessionUserIdKey) return;
      const nextPage = opts?.resetPage ? 1 : page;
      if (opts?.resetPage && page !== 1) {
        setPage(1);
      }
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("lite", "1");
        params.set("paged", "1");
        params.set("page", String(nextPage));
        params.set("pageSize", String(pageSize));
        if (search.trim()) params.set("q", search.trim());
        if (selectedRosterIds.length > 0) {
          params.set("rosterIds", selectedRosterIds.join(","));
        }
        if (selectedPositions.length > 0) {
          params.set("positions", selectedPositions.join(","));
        }
        const res = await fetch(`/api/players?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = (await res.json()) as PagedPlayersResponse;
        setPlayers((data.players ?? []).filter((p) => !p.isDeleted));
        setTotalPlayers(data.total ?? 0);
      } catch (err) {
        console.error(err);
        setPlayers([]);
        setTotalPlayers(0);
        setError(
          err instanceof Error ? err.message : "Failed to load players"
        );
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, search, selectedPositions, selectedRosterIds, sessionUserIdKey]
  );

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    getCsrfTokenFn().then((token) => setCsrf(token ?? ""));
  }, [getCsrfTokenFn]);

  useEffect(() => {
    if (!sessionUserIdKey) return;
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
  }, [sessionUserIdKey]);

  useEffect(() => {
    if (!sessionUserIdKey) return;
    const loadManagedPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        if (!res.ok) throw new Error("Failed to fetch positions");
        const data = (await res.json()) as { id: number; name: string }[];
        setManagedPositions(data.map((item) => item.name));
      } catch {
        setManagedPositions([]);
      }
    };
    void loadManagedPositions();
    const refresh = () => {
      void loadManagedPositions();
    };
    window.addEventListener("position-saved", refresh);
    return () => {
      window.removeEventListener("position-saved", refresh);
    };
  }, [sessionUserIdKey]);

  useEffect(() => {
    if (!sessionUserIdKey) return;
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
  }, [sessionUserIdKey]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(players.map((p) => p.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
      });
      return next;
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const source = favoriteOnly
      ? players.filter((p) => favorites.has(p.id))
      : players;
    return [...source].sort((a, b) => {
      const rankDiff = getPositionRank(a.position) - getPositionRank(b.position);
      if (rankDiff !== 0) return rankDiff;
      const primaryDiff = getPrimaryPosition(a.position).localeCompare(
        getPrimaryPosition(b.position),
        "ja"
      );
      if (primaryDiff !== 0) return primaryDiff;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [favoriteOnly, favorites, players]);

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
    if (deleteProgress) return;
    if (selectedIds.size === 0) return;
    if (!window.confirm("選択した選手を削除しますか？")) return;
    const ids = Array.from(selectedIds);
    setDeleteProgress({ total: ids.length, done: 0 });
    try {
      const token = csrf || (await getCsrfTokenFn()) || "";
      if (!token) {
        throw new Error("CSRFトークンを取得できませんでした。ページを再読み込みしてください。");
      }
      if (!csrf) {
        setCsrf(token);
      }
      const res = await fetch("/api/players", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete selected players");
      }
      setDeleteProgress({ total: ids.length, done: ids.length });
      const deletedIds: number[] = Array.isArray(data.deletedIds)
        ? data.deletedIds.filter((id: unknown) => typeof id === "number")
        : [];
      if (typeof data.deleted === "number" && data.deleted > 0 && deletedIds.length > 0) {
        setPlayers((prev) => prev.filter((p) => !deletedIds.includes(p.id)));
        setTotalPlayers((prev) => Math.max(0, prev - deletedIds.length));
        playDeleteSound();
      }
      if (typeof data.skipped === "number" && data.skipped > 0) {
        setError(`${data.skipped}件は権限不足のため削除されませんでした`);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to delete selected players"
      );
    } finally {
      setTimeout(() => setDeleteProgress(null), 250);
    }
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
          disabled={selectedIds.size === 0 || deleteProgress !== null}
          onClick={handleDeleteSelected}
        >
          {deleteProgress
            ? `Deleting... ${deleteProgress.done}/${deleteProgress.total}`
            : "Delete"}
        </button>
        {deleteProgress && (
          <p className="mt-2 text-sm text-cyan-200 animate-pulse">
            選択した選手を削除中です（{deleteProgress.done}/{deleteProgress.total}）
          </p>
        )}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          className="form-input w-full min-w-0"
          placeholder="Filter players..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <MultiToggleGroup
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
          legend={`Position (${positionInputs.length})`}
          options={positionOptions.map((pos) => ({ value: pos, label: pos }))}
          selectedValues={positionInputs}
          onChange={setPositionInputs}
          emptyLabel="ポジションがありません"
        />
        <label className="form-input flex min-h-10 items-center gap-2">
          <input
            type="checkbox"
            checked={favoriteOnlyInput}
            onChange={(e) => setFavoriteOnlyInput(e.target.checked)}
          />
          <span className="text-sm">お気に入りのみ</span>
        </label>
        <button
          type="button"
          className="primary-btn tap-action w-full sm:justify-self-end sm:w-auto"
          onClick={() => {
            play();
            setSearch(searchInput);
            setSelectedPositions(positionInputs);
            setSelectedRosterIds(rosterInputs);
            setFavoriteOnly(favoriteOnlyInput);
            setPage(1);
          }}
        >
          Apply Filters
        </button>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs text-cyan-100/80">
        <span>
          表示 {filteredPlayers.length}件 / 合計 {totalPlayers}件
        </span>
        <div className="flex items-center gap-2">
          <button
            className="ghost-btn px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Prev
          </button>
          <span>Page {page}</span>
          <button
            className="ghost-btn px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page * pageSize >= totalPlayers}
          >
            Next
          </button>
        </div>
      </div>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border-b px-2 py-1 text-center">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                disabled={deleteProgress !== null}
                onChange={toggleSelectAll}
              />
            </th>
            <th className="border-b px-2 py-1 text-left">背番号</th>
            <th className="border-b px-2 py-1 text-left">ポジション</th>
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
                  disabled={deleteProgress !== null}
                  onChange={() => toggleSelect(p.id)}
                />
              </td>
              <td className="px-2 py-1">{p.number ?? "-"}</td>
              <td className="px-2 py-1">{p.position.join(", ")}</td>
              <td className="px-2 py-1 text-white">
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  <WikiLink
                    name={p.name}
                    wikiUrl={p.wikiUrl}
                    className="ml-2 hide-mobile-portrait"
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
                    {p.userId === sessionUserId ? "編集" : "カスタム作成"}
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
