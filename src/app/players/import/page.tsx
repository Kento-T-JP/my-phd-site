"use client";

import { Fragment, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import useClickSound from "@/lib/useClickSound";

interface ImportedPlayer {
  name: string;
  position: string[];
  extra: Record<string, unknown>;
  selected?: boolean;
}

type SaveResult = {
  count: number;
  created?: number;
  updated?: number;
  restored?: number;
  requested?: number;
};

export default function ImportPlayersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { play } = useClickSound();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [players, setPlayers] = useState<ImportedPlayer[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8 max-w-3xl mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPlayers([]);
    setError("");
    setMessage("");
    setRowErrors([]);
    setSaveResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setError("");
    setMessage("");
    setSaveResult(null);
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const res = await fetch("/api/players/import", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "ファイルの解析に失敗しました");
      }
      const data = (await res.json()) as {
        players: ImportedPlayer[];
        errors?: unknown;
      };
      setPlayers(data.players.map((p) => ({ ...p, selected: true })));
      if ("errors" in data) {
        setRowErrors(parseRowErrors(data.errors));
      } else {
        setRowErrors([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `解析失敗: ${err.message}`
          : "解析失敗: アップロードに失敗しました",
      );
    } finally {
      setUploading(false);
    }
  };

  const togglePlayer = (index: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)),
    );
  };

  const toggleExtra = (index: number) => {
    setExpanded((prev) => (prev === index ? null : index));
  };

  const parseRowErrors = (errors: unknown): string[] => {
    if (Array.isArray(errors)) {
      if (errors.every((e) => e && typeof e === "object" && "row" in e)) {
        const arr: string[] = [];
        type RowError = { row?: unknown; message?: unknown };
        for (const e of errors as RowError[]) {
          const idx = Number(e.row);
          const msg = e.message;
          if (!Number.isNaN(idx)) {
            arr[idx] = typeof msg === "string" ? msg : String(msg);
          }
        }
        return arr;
      }
      return errors.map((e) => (typeof e === "string" ? e : String(e)));
    }
    if (errors && typeof errors === "object") {
      const arr: string[] = [];
      for (const [k, v] of Object.entries(errors)) {
        const idx = Number(k);
        if (!Number.isNaN(idx)) {
          arr[idx] = typeof v === "string" ? v : String(v);
        }
      }
      return arr;
    }
    return [];
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setSaveResult(null);
    setRowErrors([]);
    const selected = players
      .filter((p) => p.selected)
      .map((p) => ({ name: p.name, position: p.position, extra: p.extra }));
    if (selected.length === 0) {
      setError("選手が選択されていません");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/players/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: selected }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if ("errors" in data) {
          setRowErrors(parseRowErrors((data.errors as unknown)));
        }
        const msg = typeof data.error === "string" ? data.error : "保存に失敗しました";
        throw new Error(msg);
      }
      if ("errors" in data) {
        setRowErrors(parseRowErrors((data.errors as unknown)));
      } else {
        setRowErrors([]);
      }
      const count = typeof data.count === "number" ? data.count : 0;
      const created = typeof data.created === "number" ? data.created : 0;
      const updated = typeof data.updated === "number" ? data.updated : 0;
      const restored = typeof data.restored === "number" ? data.restored : 0;
      const requested = typeof data.requested === "number" ? data.requested : count;
      setSaveResult({ count, created, updated, restored, requested });
      setMessage(`${count}件の選手を反映しました`);
      setPlayers([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `保存失敗: ${err.message}`
          : "保存失敗: 保存に失敗しました",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">選手インポート（Excel）</h1>

      <section className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-4 space-y-3">
        <p className="text-sm leading-6 text-slate-200">
          <span className="font-semibold text-cyan-200">必須列:</span>{" "}
          <code>name</code>（または <code>名前</code>） /{" "}
          <code>position</code>・<code>positions</code>（または <code>ポジション</code>）
          <br />
          ポジションはカンマ or 空白区切りで複数指定できます（例: <code>CB RB</code>）。
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-sm border border-slate-700">
            <thead className="bg-slate-800 text-slate-100">
              <tr>
                <th className="border border-slate-700 px-2 py-1 text-left">name / 名前</th>
                <th className="border border-slate-700 px-2 py-1 text-left">position / ポジション</th>
                <th className="border border-slate-700 px-2 py-1 text-left">その他列</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              <tr>
                <td className="border border-slate-700 px-2 py-1">久保 建英</td>
                <td className="border border-slate-700 px-2 py-1">RW AM</td>
                <td className="border border-slate-700 px-2 py-1">number, wikiUrl, memo ...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={uploading || saving}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 sm:w-auto w-full"
          onClick={() => {
            play();
            void handleImport();
          }}
          disabled={!file || uploading}
        >
          インポート
        </button>
        {uploading && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            アップロード中…
          </div>
        )}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}
      {saveResult && (
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 p-3 text-sm text-emerald-100">
          <p className="font-semibold">保存結果</p>
          <p>
            反映: {saveResult.count}件 / 処理対象: {saveResult.requested ?? saveResult.count}件
          </p>
          <p>
            新規作成: {saveResult.created ?? 0}件 / 更新: {saveResult.updated ?? 0}件 / 復元:{" "}
            {saveResult.restored ?? 0}件
          </p>
        </div>
      )}
      {rowErrors.length > 0 && (
        <ul className="text-red-600 list-disc pl-5 rounded-lg border border-red-700/60 bg-red-950/20 p-3">
          {rowErrors.map((e, i) =>
            e ? (
              <li key={i}>{`Row ${i + 1}: ${e}`}</li>
            ) : null,
          )}
        </ul>
      )}
      {players.length > 0 && (
        <div>
          <div className="mb-2 text-sm text-slate-200">
            解析成功: {players.length}件 / 選択中: {players.filter((p) => p.selected).length}件
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border border-collapse border-slate-700">
            <thead>
              <tr className="bg-slate-800 text-slate-100">
                <th className="border border-slate-700 px-2 py-1">選択</th>
                <th className="border border-slate-700 px-2 py-1">名前</th>
                <th className="border border-slate-700 px-2 py-1">ポジション</th>
                <th className="border border-slate-700 px-2 py-1">詳細</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <Fragment key={idx}>
                  <tr
                    key={`row-${idx}`}
                    onClick={() => {
                      play();
                      toggleExtra(idx);
                    }}
                    className="cursor-pointer"
                  >
                    <td className="border border-slate-700 px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => {
                          play();
                          togglePlayer(idx);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="border border-slate-700 px-2 py-1">{p.name}</td>
                    <td className="border border-slate-700 px-2 py-1">{p.position.join(", ")}</td>
                    <td className="border border-slate-700 px-2 py-1 text-center">
                      {Object.keys(p.extra).length > 0 && (expanded === idx ? "▲" : "▼")}
                    </td>
                  </tr>
                  {expanded === idx && Object.keys(p.extra).length > 0 && (
                    <tr key={`extra-${idx}`} className="bg-gray-50">
                      <td
                        colSpan={4}
                        className="border border-slate-700 px-2 py-1 text-sm text-slate-200"
                      >
                        <pre className="whitespace-pre-wrap break-words">
                          {JSON.stringify(p.extra, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              onClick={() => {
                play();
                void handleSubmit();
              }}
              disabled={saving}
            >
              インポートを確定
            </button>
            {saving && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                保存中…
              </div>
            )}
          </div>
        </div>
      )}
      <BackButton />
    </main>
  );
}
