"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";
import useClickSound from "@/lib/useClickSound";

type Formation = {
  id: number;
  name: string;
  userId: number;
  userEmail: string;
  createdAt: string;
};

type FormationOwner = {
  id: number;
  email: string;
  formationCount: number;
};

export default function AdminFormationsPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [owners, setOwners] = useState<FormationOwner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { play } = useClickSound();

  async function load(options?: { ownerId?: number | "all"; query?: string }) {
    const effectiveOwnerId = options?.ownerId ?? selectedOwnerId;
    const effectiveQuery = options?.query ?? searchQuery;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ includeUsers: "1" });
      if (effectiveOwnerId !== "all") {
        params.set("userId", String(effectiveOwnerId));
      }
      if (effectiveQuery.trim()) {
        params.set("q", effectiveQuery.trim());
      }
      const res = await fetch(`/api/admin/formations?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { formations: Formation[]; users: FormationOwner[] };
      setFormations(data.formations ?? []);
      setOwners(data.users ?? []);
    } catch {
      setError("フォーメーションの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedOwnerId]);

  async function removeFormation(id: number) {
    if (!confirm("このフォーメーションを削除します。よろしいですか？")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/formations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

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

  return (
    <main className="space-y-4 p-1">
      <header>
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Formations</h1>
        <p className="text-sm text-cyan-100/70">ユーザー単位でフォーメーションを管理できます。</p>
      </header>
      <section className="rounded-xl border border-cyan-300/20 bg-slate-900/45 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(240px,320px)_1fr_auto] sm:items-end">
          <label className="space-y-1">
            <span className="text-xs text-cyan-100/75">ユーザー</span>
            <select
              value={selectedOwnerId === "all" ? "all" : String(selectedOwnerId)}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedOwnerId(value === "all" ? "all" : Number(value));
              }}
              className="w-full rounded-md border border-cyan-300/25 bg-slate-950/70 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/60"
            >
              <option value="all">全ユーザー</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.email} ({owner.formationCount})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-cyan-100/75">検索（名前 / メール）</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void load();
                }
              }}
              placeholder="例: 4-3-3 / user@example.com"
              className="w-full rounded-md border border-cyan-300/25 bg-slate-950/70 px-3 py-2 text-sm text-cyan-50 placeholder:text-cyan-100/45 outline-none focus:border-cyan-300/60"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                play();
                void load();
              }}
              className="rounded-md border border-cyan-300/45 px-3 py-2 text-sm text-cyan-50 hover:bg-cyan-300/15"
            >
              適用
            </button>
            <button
              type="button"
              onClick={() => {
                play();
                setSelectedOwnerId("all");
                setSearchQuery("");
                void load({ ownerId: "all", query: "" });
              }}
              className="rounded-md border border-slate-400/45 px-3 py-2 text-sm text-slate-200 hover:bg-slate-500/15"
            >
              クリア
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-cyan-100/70">表示件数: {formations.length}</p>
      </section>
      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {formations.map((f) => (
              <article key={f.id} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/formations/${f.id}`} className="text-sm font-semibold text-cyan-100 underline underline-offset-2">
                    {f.name}
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === f.id}
                    onClick={() => {
                      play();
                      void removeFormation(f.id);
                    }}
                    className="rounded-md border border-rose-300/40 px-2 py-1 text-[11px] text-rose-200 disabled:opacity-60"
                  >
                    {deletingId === f.id ? "削除中..." : "削除"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-cyan-100/70">{f.userEmail}</p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-cyan-100/80">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                {formations.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/formations/${f.id}`} className="underline underline-offset-2">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{f.userEmail}</td>
                    <td className="px-3 py-2">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={deletingId === f.id}
                        onClick={() => {
                          play();
                          void removeFormation(f.id);
                        }}
                        className="rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-60"
                      >
                        {deletingId === f.id ? "削除中..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <BackButton />
    </main>
  );
}
