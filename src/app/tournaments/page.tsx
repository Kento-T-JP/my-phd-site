"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import TournamentSelect from "@/components/TournamentSelect";

type Tournament = {
  id: number;
  name: string;
  slug: string;
};

type Roster = {
  id: number;
  title: string;
  date: string;
  endDate?: string | null;
  tournamentId: number;
  tournament: { name: string };
};

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP");
}

function confirmDanger(message: string): boolean {
  if (!confirm(message)) return false;
  return confirm("本当に実行しますか？この操作は取り消せません。");
}

export default function TournamentsPage() {
  const { data: session, status } = useSession();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);

  const [rosterTournament, setRosterTournament] = useState("");
  const [rosterTitle, setRosterTitle] = useState("");
  const [rosterDate, setRosterDate] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterInfo, setRosterInfo] = useState<string | null>(null);

  const [deletingTournamentId, setDeletingTournamentId] = useState<number | null>(null);
  const [deletingRosterId, setDeletingRosterId] = useState<number | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageInfo, setManageInfo] = useState<string | null>(null);

  const sortedTournaments = useMemo(
    () => [...tournaments].sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [tournaments],
  );
  const sortedRosters = useMemo(
    () => [...rosters].sort((a, b) => b.date.localeCompare(a.date)),
    [rosters],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setManageError(null);
    try {
      const [tournamentsRes, rostersRes] = await Promise.all([
        fetch("/api/tournaments", { cache: "no-store" }),
        fetch("/api/rosters", { cache: "no-store" }),
      ]);
      if (!tournamentsRes.ok) {
        const body = (await tournamentsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "大会一覧の取得に失敗しました。");
      }
      if (!rostersRes.ok) {
        const body = (await rostersRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "ロースター一覧の取得に失敗しました。");
      }
      const tournamentData = (await tournamentsRes.json()) as Tournament[];
      const rosterData = (await rostersRes.json()) as Roster[];
      setTournaments(Array.isArray(tournamentData) ? tournamentData : []);
      setRosters(Array.isArray(rosterData) ? rosterData : []);
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadData();
  }, [session, loadData]);

  async function addRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tournament = normalizeLabel(rosterTournament);
    const title = normalizeLabel(rosterTitle);
    if (!tournament) {
      setRosterError("大会名を入力してください。");
      return;
    }

    setSavingRoster(true);
    setRosterError(null);
    setRosterInfo(null);
    try {
      const res = await fetch("/api/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament,
          title: title || undefined,
          date: rosterDate || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<Roster>;
      if (!res.ok) {
        throw new Error(body.error || "ロースターの追加に失敗しました。");
      }
      const created = body as Roster;
      setRosterTitle("");
      setRosterDate("");
      setRosterInfo(
        `ロースター「${(created.title ?? title) || "(自動生成)"}」を追加しました。`,
      );
      if (typeof created.id === "number") {
        setRosters((prev) => {
          const next = prev.filter((item) => item.id !== created.id);
          return [...next, created];
        });
      }
      if (
        typeof created.tournamentId === "number" &&
        created.tournament?.name
      ) {
        setTournaments((prev) => {
          if (prev.some((item) => item.id === created.tournamentId)) return prev;
          return [
            ...prev,
            { id: created.tournamentId, name: created.tournament.name, slug: "" },
          ];
        });
      }
      window.dispatchEvent(new Event("tournament-saved"));
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "ロースターの追加に失敗しました。");
    } finally {
      setSavingRoster(false);
    }
  }

  async function deleteTournament(item: Tournament) {
    const confirmed = confirmDanger(
      `大会「${item.name}」を削除しますか？\n紐づくロースターも削除されます。`,
    );
    if (!confirmed) return;

    setDeletingTournamentId(item.id);
    setManageError(null);
    setManageInfo(null);
    try {
      const res = await fetch("/api/tournaments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: item.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "大会の削除に失敗しました。");
      }
      setManageInfo(`大会「${item.name}」を削除しました。`);
      setTournaments((prev) => prev.filter((current) => current.id !== item.id));
      setRosters((prev) => prev.filter((current) => current.tournamentId !== item.id));
      window.dispatchEvent(new Event("tournament-saved"));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "大会の削除に失敗しました。");
    } finally {
      setDeletingTournamentId(null);
    }
  }

  async function deleteRoster(item: Roster) {
    const confirmed = confirmDanger(`ロースター「${item.title}」を削除しますか？`);
    if (!confirmed) return;

    setDeletingRosterId(item.id);
    setManageError(null);
    setManageInfo(null);
    try {
      const res = await fetch("/api/rosters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId: item.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "ロースターの削除に失敗しました。");
      }
      setManageInfo(`ロースター「${item.title}」を削除しました。`);
      setRosters((prev) => prev.filter((current) => current.id !== item.id));
      window.dispatchEvent(new Event("tournament-saved"));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "ロースターの削除に失敗しました。");
    } finally {
      setDeletingRosterId(null);
    }
  }

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8">
        <LoadingSpinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to manage tournaments and rosters.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 space-y-4">
      <section className="glass-panel p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold">大会・ロースター管理</h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          大会名必須・ロースター名任意で登録できます。ロースター名未入力時は日付ベースで自動命名されます。
        </p>
      </section>

      <section className="glass-panel p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold">ロースターを追加</h2>
        <form onSubmit={addRoster} className="space-y-2">
          <TournamentSelect
            value={rosterTournament}
            onChange={setRosterTournament}
            listId="roster-tournament-list"
            placeholder="大会名"
          />
          <input
            type="text"
            value={rosterTitle}
            onChange={(event) => setRosterTitle(event.target.value)}
            placeholder="ロースター名（任意）"
            className="w-full rounded-lg border border-cyan-300/25 bg-slate-950/55 px-3 py-2 outline-none focus:border-cyan-300"
            maxLength={120}
          />
          <input
            type="date"
            value={rosterDate}
            onChange={(event) => setRosterDate(event.target.value)}
            className="w-full sm:w-64 rounded-lg border border-cyan-300/25 bg-slate-950/55 px-3 py-2 outline-none focus:border-cyan-300"
          />
          <button
            type="submit"
            disabled={savingRoster}
            className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium"
          >
            {savingRoster ? "追加中..." : "ロースターを追加"}
          </button>
        </form>
        <p className="text-xs text-cyan-100/65">
          必須: 大会名 / 任意: ロースター名・日付（ロースター名が空の場合は自動命名）
        </p>
        {rosterError && <p className="text-sm text-red-300">{rosterError}</p>}
        {rosterInfo && <p className="text-sm text-emerald-300">{rosterInfo}</p>}
      </section>

      <section className="glass-panel p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">登録済みデータ</h2>
        {manageError && <p className="text-sm text-red-300">{manageError}</p>}
        {manageInfo && <p className="text-sm text-red-300">{manageInfo}</p>}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="font-semibold text-cyan-50">大会</h3>
              {sortedTournaments.length === 0 ? (
                <p className="text-sm text-cyan-100/75">大会はまだ登録されていません。</p>
              ) : (
                <ul className="space-y-2">
                  {sortedTournaments.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-cyan-300/20 bg-slate-900/40 p-3 flex items-center justify-between gap-3"
                    >
                      <span className="text-cyan-50">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => void deleteTournament(item)}
                        disabled={deletingTournamentId === item.id}
                        className="rounded-md px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium"
                      >
                        {deletingTournamentId === item.id ? "削除中..." : "削除"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-cyan-50">ロースター</h3>
              {sortedRosters.length === 0 ? (
                <p className="text-sm text-cyan-100/75">ロースターはまだ登録されていません。</p>
              ) : (
                <ul className="space-y-2">
                  {sortedRosters.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-cyan-300/20 bg-slate-900/40 p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-cyan-50 text-sm font-medium">{item.tournament.name} / {item.title}</p>
                        <p className="text-xs text-cyan-100/70">{formatDate(item.date)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteRoster(item)}
                        disabled={deletingRosterId === item.id}
                        className="rounded-md px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium"
                      >
                        {deletingRosterId === item.id ? "削除中..." : "削除"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
