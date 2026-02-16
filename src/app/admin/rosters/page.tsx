"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";
import useClickSound from "@/lib/useClickSound";

type AdminUser = {
  id: number;
  email: string;
};

type AdminRoster = {
  id: number;
  title: string;
  date: string;
  endDate: string | null;
  userId: number | null;
  tournamentId: number;
  tournament: { name: string; slug: string };
  _count: { players: number };
};

type TournamentRow = {
  tournamentId: number;
  name: string;
  slug: string;
  rosterCount: number;
  playerCount: number;
};

export default function AdminRostersPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [rosters, setRosters] = useState<AdminRoster[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { play } = useClickSound();

  const selectedUserLabel = useMemo(() => {
    const found = users.find((u) => String(u.id) === selectedUser);
    return found?.email ?? "ユーザー";
  }, [selectedUser, users]);

  const tournaments = useMemo<TournamentRow[]>(() => {
    const map = new Map<number, TournamentRow>();
    for (const r of rosters) {
      const current = map.get(r.tournamentId);
      if (current) {
        current.rosterCount += 1;
        current.playerCount += r._count.players;
      } else {
        map.set(r.tournamentId, {
          tournamentId: r.tournamentId,
          name: r.tournament.name,
          slug: r.tournament.slug,
          rosterCount: 1,
          playerCount: r._count.players,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ja")
    );
  }, [rosters]);

  async function loadRosters(userId: string) {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/rosters?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to fetch rosters");
      setRosters(await res.json());
    } catch {
      setError("ロスター一覧の取得に失敗しました");
      setRosters([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) throw new Error("Failed to fetch users");
        const userList: AdminUser[] = await res.json();
        setUsers(userList);
        const defaultUser = userList.length > 0 ? String(userList[0].id) : "";
        setSelectedUser(defaultUser);
        if (defaultUser) {
          await loadRosters(defaultUser);
        } else {
          setRosters([]);
        }
      } catch {
        setError("初期データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [status, isAdmin]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin || !selectedUser) return;
    loadRosters(selectedUser);
  }, [selectedUser, status, isAdmin]);

  if (status === "loading") {
    return (
      <main className="p-1">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-1">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-1">
        <p>Unauthorized</p>
      </main>
    );
  }

  async function deleteTournamentForUser(tournamentId: number, tournamentName: string) {
    if (!confirm(`トーナメント「${tournamentName}」の ${selectedUserLabel} 分のロスターを削除しますか？`)) {
      return;
    }
    play();
    setDeletingKey(`t-${tournamentId}`);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/tournaments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, userId: selectedUser }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "削除に失敗しました");
      }
      setInfo(`トーナメント「${tournamentName}」の対象ロスターを削除しました`);
      await loadRosters(selectedUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "削除に失敗しました";
      setError(msg);
    } finally {
      setDeletingKey(null);
    }
  }

  async function deleteRoster(rosterId: number, title: string) {
    if (!confirm(`ロスター「${title}」を削除しますか？`)) return;
    play();
    setDeletingKey(`r-${rosterId}`);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/rosters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "削除に失敗しました");
      }
      setInfo(`ロスター「${title}」を削除しました`);
      await loadRosters(selectedUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "削除に失敗しました";
      setError(msg);
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <main className="space-y-4 p-1">
      <header>
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Rosters</h1>
        <p className="text-sm text-cyan-100/70">
          Delete tournaments or individual rosters with user scope.
        </p>
      </header>

      <div className="max-w-xl">
        <label className="block text-sm mb-1">対象ユーザー</label>
        <select
          className="w-full rounded-lg border border-cyan-300/30 bg-slate-900/45 p-2 text-cyan-50"
          value={selectedUser}
          onChange={(e) => {
            play();
            setSelectedUser(e.target.value);
          }}
          disabled={isLoading || deletingKey !== null}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {info && <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">{info}</p>}

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-cyan-50">トーナメント（ユーザー別）</h2>
            <div className="space-y-2 md:hidden">
              {tournaments.length === 0 ? (
                <div className="rounded-xl border border-cyan-300/20 bg-slate-900/40 p-3 text-sm text-cyan-100/75">
                  該当トーナメントはありません
                </div>
              ) : (
                tournaments.map((t) => (
                  <article key={t.tournamentId} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                    <p className="text-sm font-semibold text-cyan-50">{t.name}</p>
                    <p className="mt-1 text-xs text-cyan-100/70">Rosters: {t.rosterCount}</p>
                    <p className="text-xs text-cyan-100/70">Players: {t.playerCount}</p>
                    <button
                      className="mt-2 rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-50"
                      onClick={() => deleteTournamentForUser(t.tournamentId, t.name)}
                      disabled={deletingKey !== null}
                    >
                      {deletingKey === `t-${t.tournamentId}` ? "削除中..." : "このユーザー分を削除"}
                    </button>
                  </article>
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/70 text-cyan-100/80">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-right">Rosters</th>
                    <th className="px-3 py-2 text-right">Players</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                  {tournaments.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-cyan-100/70" colSpan={4}>
                        該当トーナメントはありません
                      </td>
                    </tr>
                  ) : (
                    tournaments.map((t) => (
                      <tr key={t.tournamentId}>
                        <td className="px-3 py-2">{t.name}</td>
                        <td className="px-3 py-2 text-right">{t.rosterCount}</td>
                        <td className="px-3 py-2 text-right">{t.playerCount}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-50"
                            onClick={() => deleteTournamentForUser(t.tournamentId, t.name)}
                            disabled={deletingKey !== null}
                          >
                            {deletingKey === `t-${t.tournamentId}` ? "削除中..." : "このユーザー分を削除"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-cyan-50">ロスター（個別削除）</h2>
            <div className="space-y-2 md:hidden">
              {rosters.length === 0 ? (
                <div className="rounded-xl border border-cyan-300/20 bg-slate-900/40 p-3 text-sm text-cyan-100/75">
                  該当ロスターはありません
                </div>
              ) : (
                rosters.map((r) => (
                  <article key={r.id} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                    <p className="text-sm font-semibold text-cyan-50">{r.tournament.name}</p>
                    <p className="text-xs text-cyan-100/70">{r.title}</p>
                    <p className="mt-1 text-xs text-cyan-100/70">Players: {r._count.players}</p>
                    <p className="text-xs text-cyan-100/70">{new Date(r.date).toLocaleDateString()}</p>
                    <button
                      className="mt-2 rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-50"
                      onClick={() => deleteRoster(r.id, r.title)}
                      disabled={deletingKey !== null}
                    >
                      {deletingKey === `r-${r.id}` ? "削除中..." : "削除"}
                    </button>
                  </article>
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/70 text-cyan-100/80">
                  <tr>
                    <th className="px-3 py-2 text-left">Tournament</th>
                    <th className="px-3 py-2 text-left">Roster</th>
                    <th className="px-3 py-2 text-right">Players</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                  {rosters.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-cyan-100/70" colSpan={5}>
                        該当ロスターはありません
                      </td>
                    </tr>
                  ) : (
                    rosters.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">{r.tournament.name}</td>
                        <td className="px-3 py-2">{r.title}</td>
                        <td className="px-3 py-2 text-right">{r._count.players}</td>
                        <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-50"
                            onClick={() => deleteRoster(r.id, r.title)}
                            disabled={deletingKey !== null}
                          >
                            {deletingKey === `r-${r.id}` ? "削除中..." : "削除"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="pt-1">
        <BackButton />
      </div>
    </main>
  );
}
