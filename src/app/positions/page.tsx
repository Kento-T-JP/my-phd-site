"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getDefaultPositions } from "@/lib/defaultPositions";

type UserPosition = {
  id: number;
  name: string;
};

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function confirmDanger(message: string): boolean {
  if (!confirm(message)) return false;
  return confirm("本当に実行しますか？この操作は取り消せません。");
}

type DisplayPosition = {
  id?: number;
  name: string;
  source: "default" | "custom";
};

export default function PositionsPage() {
  const { data: session, status } = useSession();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [infoTone, setInfoTone] = useState<"add" | "delete">("add");

  const sorted = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [positions],
  );
  const displayPositions = useMemo<DisplayPosition[]>(() => {
    const defaults = getDefaultPositions().map((name) => ({
      name,
      source: "default" as const,
    }));
    const custom = sorted
      .filter(
        (item) =>
          !defaults.some(
            (base) => normalizeLabel(base.name).toLowerCase() === normalizeLabel(item.name).toLowerCase(),
          ),
      )
      .map((item) => ({ id: item.id, name: item.name, source: "custom" as const }));
    return [...defaults, ...custom];
  }, [sorted]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/positions", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "ポジション一覧の取得に失敗しました。");
      }
      const data = (await res.json()) as UserPosition[];
      setPositions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ポジション一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [load, session]);

  async function addPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLabel(name);
    if (!normalized) {
      setError("ポジション名を入力してください。");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    setInfoTone("add");
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | ({ error?: string } & Partial<UserPosition>)
        | UserPosition;
      if (!res.ok) {
        throw new Error(("error" in body && body.error) || "ポジションの追加に失敗しました。");
      }
      const created = body as UserPosition;
      setPositions((prev) => [...prev.filter((p) => p.id !== created.id), created]);
      setName("");
      setInfoTone("add");
      setInfo(`ポジション「${created.name}」を追加しました。`);
      window.dispatchEvent(new Event("position-saved"));
      window.dispatchEvent(new Event("position-added"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ポジションの追加に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function deletePosition(item: UserPosition) {
    const confirmed = confirmDanger(`ポジション「${item.name}」を削除しますか？`);
    if (!confirmed) return;
    setDeletingId(item.id);
    setError(null);
    setInfo(null);
    setInfoTone("delete");
    try {
      const res = await fetch("/api/positions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: item.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "ポジションの削除に失敗しました。");
      }
      setPositions((prev) => prev.filter((p) => p.id !== item.id));
      setInfoTone("delete");
      setInfo(`ポジション「${item.name}」を削除しました。`);
      window.dispatchEvent(new Event("position-saved"));
      window.dispatchEvent(new Event("position-added"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ポジションの削除に失敗しました。");
    } finally {
      setDeletingId(null);
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
          Please <Link href="/login">login</Link> to manage positions.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 space-y-4">
      <section className="glass-panel p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold">ポジション管理</h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          デフォルトポジションは固定表示、追加したポジションのみ削除できます。
        </p>
      </section>

      <section className="glass-panel p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold">ポジションを追加</h2>
        <form onSubmit={addPosition} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: RWB"
            className="w-full rounded-lg border border-cyan-300/25 bg-slate-950/55 px-3 py-2 outline-none focus:border-cyan-300"
            maxLength={40}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium"
          >
            {saving ? "追加中..." : "ポジションを追加"}
          </button>
        </form>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && (
          <p className={`text-sm ${infoTone === "delete" ? "text-red-300" : "text-emerald-300"}`}>
            {info}
          </p>
        )}
      </section>

      <section className="glass-panel p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold">登録済みポジション</h2>
        {loading ? (
          <LoadingSpinner />
        ) : displayPositions.length === 0 ? (
          <p className="text-sm text-cyan-100/75">登録済みポジションはありません。</p>
        ) : (
          <ul className="space-y-2">
            {displayPositions.map((item) => (
              <li
                key={`${item.source}-${item.id ?? item.name}`}
                className="rounded-lg border border-cyan-300/20 bg-slate-900/45 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-cyan-50">{item.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      item.source === "default"
                        ? "border border-cyan-300/40 text-cyan-200"
                        : "border border-emerald-300/40 text-emerald-200"
                    }`}
                  >
                    {item.source === "default" ? "Default" : "Custom"}
                  </span>
                </div>
                {item.source === "custom" && item.id != null ? (
                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => void deletePosition({ id: item.id, name: item.name })}
                    className="rounded-md border border-red-400/45 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingId === item.id ? "削除中..." : "削除"}
                  </button>
                ) : (
                  <span className="text-xs text-cyan-100/60">削除不可</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
