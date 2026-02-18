"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { FormationSharePayload } from "@/types/formationShare";
import type { SavedFormation } from "@/types/formation";
import { formations } from "@/data/formations";

const DEFAULT_FORMATION_NAME = "4-3-3";
const OFFSET_STEP = 24;
const BENCH_POSITION_ORDER = ["GK", "DF", "MF", "MF/FW", "FW"];
const BENCH_LIMIT = 12;
const clampPercent = (value: number, min = 6, max = 94) =>
  Math.min(max, Math.max(min, value));

function buildDefaultPositions(payload: FormationSharePayload): Record<number, { top: number; left: number }> {
  const defaultFormation =
    formations.find((f) => f.name === DEFAULT_FORMATION_NAME) ?? formations[0];
  const templateName = payload.baseFormationName ?? payload.formationName;
  const template = formations.find((f) => f.name === templateName) ?? defaultFormation;

  const positions: Record<number, { top: number; left: number }> = {};
  let index = 0;
  Object.keys(template.positions).forEach((posKey) => {
    const slot = template.positions[posKey as keyof typeof template.positions];
    if (!slot) return;
    for (let i = 0; i < slot.max && index < payload.lineupOrder.length; i += 1) {
      const playerId = payload.lineupOrder[index];
      index += 1;
      const offset = slot.max > 1 ? (i - (slot.max - 1) / 2) * OFFSET_STEP : 0;
      positions[playerId] = {
        top: clampPercent(slot.top),
        left: clampPercent(slot.left + offset),
      };
    }
  });
  return positions;
}

type ShareResponse = {
  token: string;
  expiresAt: string;
  createdAt: string;
  author: { id: number; name: string | null; email: string | null };
  formation: FormationSharePayload;
};

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [share, setShare] = useState<ShareResponse | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/formation-shares/${token}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 410) {
          setError("この共有リンクは有効期限が切れています。");
        } else {
          setError("共有データを読み込めませんでした。");
        }
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ShareResponse;
      setShare(data);
      setLoading(false);
    }
    void load();
  }, [token]);

  const playerMap = useMemo(() => {
    const map = new Map<number, FormationSharePayload["players"][number]>();
    share?.formation.players.forEach((player) => {
      map.set(player.sourcePlayerId, player);
    });
    return map;
  }, [share]);

  const visibleRows = useMemo(() => {
    if (!share) return [];
    const payload = share.formation;
    const ids = Array.from(new Set([...payload.lineupOrder, ...payload.benchOrder]));
    return ids.map((id) => {
      const player = playerMap.get(id);
      const pos = payload.playerPositions[String(id)];
      return {
        id,
        name: player?.name ?? "Unknown",
        number: player?.number ?? null,
        position: player?.position ?? [],
        top: pos?.top ?? null,
        left: pos?.left ?? null,
      };
    });
  }, [playerMap, share]);

  const lineupPlayers = useMemo(() => {
    if (!share) return [];
    const defaultPositions = buildDefaultPositions(share.formation);
    return share.formation.lineupOrder.map((id, idx) => {
      const player = playerMap.get(id);
      const pos = share.formation.playerPositions[String(id)] ?? defaultPositions[id];
      const fallbackTop = 10 + Math.floor(idx / 4) * 22;
      const fallbackLeft = 15 + (idx % 4) * 22;
      return {
        id,
        name: player?.name ?? "Unknown",
        number: player?.number ?? null,
        top: pos?.top ?? fallbackTop,
        left: pos?.left ?? fallbackLeft,
      };
    });
  }, [playerMap, share]);

  const benchPlayersRaw = useMemo(() => {
    if (!share) return [];
    return share.formation.benchOrder.map((id) => {
      const player = playerMap.get(id);
      return {
        id,
        name: player?.name ?? "Unknown",
        number: player?.number ?? null,
        position: player?.position ?? [],
      };
    });
  }, [playerMap, share]);

  const { benchPlayers, offBenchPlayers } = useMemo(() => {
    const getBenchSortPos = (position: string[]) => {
      if (position.includes("MF/FW") || position.includes("MF") || position.includes("FW")) {
        return "MF/FW";
      }
      return position[0] ?? "";
    };
    const sorted = [...benchPlayersRaw].sort((a, b) => {
      const posA = getBenchSortPos(a.position);
      const posB = getBenchSortPos(b.position);
      const idxA = BENCH_POSITION_ORDER.indexOf(posA);
      const idxB = BENCH_POSITION_ORDER.indexOf(posB);
      if (idxA === -1 && idxB === -1) return posA.localeCompare(posB);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return {
      benchPlayers: sorted.slice(0, BENCH_LIMIT),
      offBenchPlayers: sorted.slice(BENCH_LIMIT),
    };
  }, [benchPlayersRaw]);

  const handleImport = async () => {
    if (importing) return;
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/share/${token}`)}`);
      return;
    }
    setImporting(true);
    setMessage("");
    setError("");
    const res = await fetch(`/api/formation-shares/${token}/import`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as {
      formation?: SavedFormation;
      error?: string;
    };
    if (!res.ok || !data.formation?.id) {
      setError(data.error ?? "取り込みに失敗しました。");
      setImporting(false);
      return;
    }
    setMessage("取り込みが完了しました。フォーメーション画面へ移動します。");
    setTimeout(() => {
      router.push(`/formations?formationId=${data.formation?.id}`);
    }, 700);
  };

  if (loading || status === "loading") {
    return (
      <main className="p-4 sm:p-8">
        <LoadingSpinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 sm:p-8 space-y-4">
        <h1 className="text-xl font-bold">Shared Formation</h1>
        <p className="status-error">{error}</p>
        <Link href="/home" className="underline">
          Homeへ戻る
        </Link>
      </main>
    );
  }

  if (!share) {
    return null;
  }

  return (
    <main className="p-4 sm:p-8 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Shared Formation</h1>
        <p className="text-sm text-cyan-100/75">
          {share.formation.formationName}
          {share.author.name ? ` by ${share.author.name}` : ""}
        </p>
        <p className="text-xs text-cyan-100/70">
          有効期限: {new Date(share.expiresAt).toLocaleString("ja-JP")}
        </p>
      </header>
      <section className="glass-panel p-3 sm:p-5">
        <div className="relative mx-auto w-full max-w-4xl rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-[#0d7f4f] to-[#0a5a3a] min-h-[520px] overflow-hidden">
          <div className="absolute inset-4 border border-cyan-100/45 rounded-xl" />
          <div className="absolute left-1/2 top-4 bottom-4 w-px bg-cyan-100/45 -translate-x-1/2" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full border border-cyan-100/45 -translate-x-1/2 -translate-y-1/2" />
          {lineupPlayers.map((player) => (
            <div
              key={player.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-950/70 border border-cyan-200/35 text-center text-xs text-cyan-50 min-w-20"
              style={{ top: `${player.top}%`, left: `${player.left}%` }}
            >
              <div className="font-semibold leading-4">{player.name}</div>
              <div className="text-[11px] text-cyan-100/80">
                {player.number ?? "-"}
              </div>
            </div>
          ))}
        </div>
        {benchPlayers.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-cyan-100/90 mb-2">Bench</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {benchPlayers.map((player) => (
                <div
                  key={player.id}
                  className="rounded-lg border border-cyan-300/25 bg-slate-900/55 px-2 py-2 text-xs"
                >
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-cyan-100/80">
                    #{player.number ?? "-"} {player.position.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {offBenchPlayers.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-cyan-100/90 mb-2">Off Bench</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {offBenchPlayers.map((player) => (
                <div
                  key={player.id}
                  className="rounded-lg border border-cyan-300/20 bg-slate-950/50 px-2 py-2 text-xs"
                >
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-cyan-100/80">
                    #{player.number ?? "-"} {player.position.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {visibleRows.length === 0 && (
          <p className="mt-3 text-sm text-cyan-100/80">
            この共有フォーメーションには表示できる選手がいません。
          </p>
        )}
      </section>
      <section className="space-y-2">
        <button
          type="button"
          className="primary-btn w-full sm:w-auto"
          disabled={importing}
          onClick={() => {
            void handleImport();
          }}
        >
          {session ? (importing ? "取り込み中..." : "このフォーメーションを取り込む") : "ログインして取り込む"}
        </button>
        <div>
          <Link
            href="/home"
            className="inline-flex rounded-md border border-cyan-300/30 px-3 py-1.5 text-sm text-cyan-100/90 hover:bg-cyan-300/10"
          >
            Homeへ戻る
          </Link>
        </div>
      </section>
      {message && <p className="status-success text-sm">{message}</p>}
    </main>
  );
}
