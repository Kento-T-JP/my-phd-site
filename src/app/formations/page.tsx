"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SavedFormation } from "@/types/formation";
import Formation from "@/components/Formation";
import LoadingSpinner from "@/components/LoadingSpinner";
import useClickSound from "@/lib/useClickSound";

function FormationsPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formationId = searchParams.get("formationId");
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const { play } = useClickSound();
  const storageKey = `selectedFormation_${session?.user?.id ?? "anonymous"}`;

  const loadList = useCallback(async () => {
    const res = await fetch("/api/formations", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as SavedFormation[];
      setList(data);
      if (data.length > 0) {
        setSelectedId((prev) => {
          if (prev !== "" && data.some((f) => f.id === prev)) return prev;
          const paramId = formationId ? Number(formationId) : NaN;
          if (!Number.isNaN(paramId) && data.some((f) => f.id === paramId)) {
            return paramId;
          }
          if (typeof window !== "undefined") {
            const stored = Number(localStorage.getItem(storageKey));
            if (!Number.isNaN(stored) && data.some((f) => f.id === stored)) {
              return stored;
            }
          }
          return data[0].id;
        });
      } else {
        setSelectedId("");
      }
    }
    setLoading(false);
  }, [formationId, storageKey]);

  useEffect(() => {
    if (!session) return;
    loadList();
  }, [session, loadList]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("このフォーメーションを削除しますか？")) return;
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? "" : prev));
  };

  const handleSaved = (saved: SavedFormation) => {
    setList((prev) => [...prev, saved]);
    setSelectedId(saved.id);
  };

  const handleCreateShare = async () => {
    if (!selectedId || isCreatingShare) return;
    setIsCreatingShare(true);
    setShareStatus("");
    setShareUrl("");
    const res = await fetch("/api/formation-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formationId: selectedId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      shareUrl?: string;
      expiresAt?: string;
      error?: string;
    };
    if (!res.ok || !data.shareUrl) {
      setShareStatus(data.error ?? "共有リンクの作成に失敗しました。");
      setIsCreatingShare(false);
      return;
    }
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", "formation_share_created", {
      source: "formations_page",
    });
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/event/formation_share_created" }),
    }).catch(() => {});
    setShareUrl(data.shareUrl);
    const expiryNote = data.expiresAt
      ? `（有効期限: ${new Date(data.expiresAt).toLocaleString("ja-JP")} / 3日間有効）`
      : "（3日間有効）";
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setShareStatus(`共有リンクをコピーしました。${expiryNote}`);
    } catch {
      setShareStatus(`共有リンクを作成しました。${expiryNote}`);
    }
    setIsCreatingShare(false);
  };

  const selectedFormation =
    selectedId === "" ? null : list.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    if (selectedId === "") {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(selectedId));
  }, [selectedId, storageKey]);

  useEffect(() => {
    setShareStatus("");
    setShareUrl("");
  }, [selectedId]);

  useEffect(() => {
    const current = selectedId === "" ? null : String(selectedId);
    if (current === formationId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId === "") {
      params.delete("formationId");
    } else {
      params.set("formationId", String(selectedId));
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [formationId, pathname, router, searchParams, selectedId]);

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view your formations.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-4">Saved Formations</h1>
      {loading ? (
        <LoadingSpinner />
      ) : list.length === 0 ? (
        <p>No formations saved.</p>
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <select
              className="border p-1"
              value={selectedId}
              onChange={(e) =>
                setSelectedId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            >
              {list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {selectedId && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    play();
                    void handleCreateShare();
                  }}
                  className="px-3 py-2 rounded border border-emerald-300/55 bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
                  disabled={isCreatingShare}
                >
                  {isCreatingShare ? "共有リンク作成中..." : "共有リンクを作成"}
                </button>
                <button
                  onClick={() => {
                    play();
                    handleDelete(Number(selectedId));
                  }}
                  className="px-3 py-2 rounded border border-red-300/55 bg-red-500/25 text-red-100 hover:bg-red-500/35"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          {shareStatus && <p className="mb-3 text-sm text-cyan-100/85">{shareStatus}</p>}
          {shareUrl && (
            <p className="mb-3 text-sm break-all">
              <a href={shareUrl} className="underline text-cyan-100">
                {shareUrl}
              </a>
            </p>
          )}
          {selectedFormation && (
            <Formation
              initialFormation={selectedFormation}
              onSaved={handleSaved}
              onUpdated={loadList}
            />
          )}
        </>
      )}
    </main>
  );
}

export default function FormationsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FormationsPageContent />
    </Suspense>
  );
}
