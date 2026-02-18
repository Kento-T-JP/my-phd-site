"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import type { SavedFormation } from "@/types/formation";
import type { Player } from "@/types/player";
import BackButton from "@/components/BackButton";
import WikiLink from "@/components/WikiLink";
import LoadingSpinner from "@/components/LoadingSpinner";

function formatDateLabel(value?: string | Date): string {
  if (!value) return "更新日時なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新日時なし";
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Player[]>([]);
  const [favLoading, setFavLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    async function load() {
      const res = await fetch("/api/formations", { cache: "no-store" });
      if (res.ok) {
        setList((await res.json()) as SavedFormation[]);
      }
      setLoading(false);
    }
    load();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadFavorites() {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        setFavorites((await res.json()) as Player[]);
      }
      setFavLoading(false);
    }
    loadFavorites();
  }, [session]);

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
        <p className="text-cyan-100/90">
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 space-y-4">
      <section className="glass-panel p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold">My Page</h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          アカウント情報と保存済みデータを確認できます。
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/40 px-3 py-2">
            <p className="text-xs text-cyan-100/70">Email</p>
            <p className="text-sm text-cyan-50 break-all">{session.user?.email ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/40 px-3 py-2">
            <p className="text-xs text-cyan-100/70">Saved Formations</p>
            <p className="text-lg font-semibold text-cyan-50">{list.length}</p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/40 px-3 py-2">
            <p className="text-xs text-cyan-100/70">Favorite Players</p>
            <p className="text-lg font-semibold text-cyan-50">{favorites.length}</p>
          </div>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <h2 className="text-lg font-bold mb-3">Saved Formations</h2>
        {loading ? (
          <LoadingSpinner />
        ) : list.length === 0 ? (
          <p className="text-sm text-cyan-100/75">保存済みフォーメーションはありません。</p>
        ) : (
          <ul className="space-y-2">
            {list.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-cyan-300/20 bg-slate-900/45 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-cyan-50">{f.name}</p>
                  <p className="text-xs text-cyan-100/70">
                    {formatDateLabel(f.updatedAt ?? f.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/formations?formationId=${f.id}`}
                  className="inline-flex rounded-md border border-cyan-300/35 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-300/10"
                >
                  開く
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <h2 className="text-lg font-bold mb-3">Favorite Players</h2>
        {favLoading ? (
          <LoadingSpinner />
        ) : favorites.length === 0 ? (
          <p className="text-sm text-cyan-100/75">お気に入り選手はまだいません。</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-cyan-300/20 bg-slate-900/45 px-3 py-2 flex items-center gap-3"
              >
                {f.image ? (
                  <Image
                    src={f.image}
                    alt={f.name}
                    width={44}
                    height={44}
                    className="w-11 h-11 object-cover rounded-full"
                  />
                ) : (
                  <div className="w-11 h-11 flex items-center justify-center bg-gray-300/40 rounded-full text-center text-xs text-cyan-100">
                    No image
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-cyan-50 truncate">
                    #{f.number ?? "-"} {f.name}
                  </p>
                  <WikiLink
                    name={f.name}
                    wikiUrl={f.wikiUrl}
                    className="block mt-0.5"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <BackButton />
      </div>
    </main>
  );
}
