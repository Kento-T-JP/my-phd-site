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
  const [selectedUser, setSelectedUser] = useState<string>("shared");
  const [rosters, setRosters] = useState<AdminRoster[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { play } = useClickSound();

  const selectedUserLabel = useMemo(() => {
    if (selectedUser === "shared") return "共有データ";
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

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (!res.ok) throw new Error("Failed to fetch users");
    setUsers(await res.json());
  }

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
        await loadUsers();
        await loadRosters(selectedUser);
      } catch {
        setError("初期データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [status, isAdmin]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    loadRosters(selectedUser);
  }, [selectedUser]);

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-4 sm:p-8">
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
    <main className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-4">トーナメント/ロスター管理</h1>

      <div className="mb-4 max-w-xl">
        <label className="block text-sm mb-1">対象ユーザー</label>
        <select
          className="w-full border rounded p-2"
          value={selectedUser}
          onChange={(e) => {
            play();
            setSelectedUser(e.target.value);
          }}
          disabled={isLoading || deletingKey !== null}
        >
          <option value="shared">共有データ（userId: null）</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 mb-3">{error}</p>}
      {info && <p className="text-green-600 mb-3">{info}</p>}

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">トーナメント（ユーザー別）</h2>
            <table className="min-w-full border text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Name</th>
                  <th className="border px-2 py-1 text-right">Rosters</th>
                  <th className="border px-2 py-1 text-right">Players</th>
                  <th className="border px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.length === 0 ? (
                  <tr>
                    <td className="border px-2 py-2 text-center" colSpan={4}>
                      該当トーナメントはありません
                    </td>
                  </tr>
                ) : (
                  tournaments.map((t) => (
                    <tr key={t.tournamentId}>
                      <td className="border px-2 py-1">{t.name}</td>
                      <td className="border px-2 py-1 text-right">{t.rosterCount}</td>
                      <td className="border px-2 py-1 text-right">{t.playerCount}</td>
                      <td className="border px-2 py-1 text-center">
                        <button
                          className="underline text-red-600 disabled:opacity-50"
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
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">ロスター（個別削除）</h2>
            <table className="min-w-full border text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Tournament</th>
                  <th className="border px-2 py-1 text-left">Roster</th>
                  <th className="border px-2 py-1 text-right">Players</th>
                  <th className="border px-2 py-1 text-left">Date</th>
                  <th className="border px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rosters.length === 0 ? (
                  <tr>
                    <td className="border px-2 py-2 text-center" colSpan={5}>
                      該当ロスターはありません
                    </td>
                  </tr>
                ) : (
                  rosters.map((r) => (
                    <tr key={r.id}>
                      <td className="border px-2 py-1">{r.tournament.name}</td>
                      <td className="border px-2 py-1">{r.title}</td>
                      <td className="border px-2 py-1 text-right">{r._count.players}</td>
                      <td className="border px-2 py-1">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="border px-2 py-1 text-center">
                        <button
                          className="underline text-red-600 disabled:opacity-50"
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
          </section>
        </>
      )}

      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
