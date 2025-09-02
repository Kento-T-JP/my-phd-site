"use client";

import { Fragment, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

interface ImportedPlayer {
  name: string;
  position: string[];
  extra: Record<string, unknown>;
  selected?: boolean;
}

export default function ImportPlayersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [players, setPlayers] = useState<ImportedPlayer[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setRowErrors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

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
  };

  const handleImport = async () => {
    if (!file) return;
    setError("");
    setMessage("");
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
      const data = (await res.json()) as { players: ImportedPlayer[] };
      setPlayers(data.players.map((p) => ({ ...p, selected: true })));
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
      setMessage(`${count}件の選手を保存しました`);
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
    <main className="p-4 sm:p-8 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">選手インポート</h1>
      <p className="text-sm text-white-600">
        Upload an Excel file (<code>.xlsx</code>) that includes the required columns:
        <code>name</code> (Japanese: 名前) and <code>position</code> or <code>positions</code>
        (Japanese: ポジション). Multiple positions should be separated by commas or spaces.
        <br />
        <br />
        エクセルファイル（<code>.xlsx</code>）には、必ず列（カラム）として
        <code>name</code>（日本語：名前）と <code>position</code> または
        <code>positions</code>（日本語：ポジション）を含めてください。
        複数のポジションはカンマまたは空白で区切って入力できます。
        日本語の列名 <code>名前</code> と <code>ポジション</code> も使用できます。
      </p>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={uploading || saving}
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          onClick={handleImport}
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
      {players.length > 0 && (
        <div>
          <table className="w-full border border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-800">
                <th className="border px-2 py-1">選択</th>
                <th className="border px-2 py-1">名前</th>
                <th className="border px-2 py-1">ポジション</th>
                <th className="border px-2 py-1">詳細</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <Fragment key={idx}>
                  <tr
                    key={`row-${idx}`}
                    onClick={() => toggleExtra(idx)}
                    className="cursor-pointer"
                  >
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => togglePlayer(idx)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="border px-2 py-1">{p.name}</td>
                    <td className="border px-2 py-1">{p.position.join(", ")}</td>
                    <td className="border px-2 py-1 text-center">
                      {Object.keys(p.extra).length > 0 && (expanded === idx ? "▲" : "▼")}
                    </td>
                  </tr>
                  {expanded === idx && Object.keys(p.extra).length > 0 && (
                    <tr key={`extra-${idx}`} className="bg-gray-50">
                      <td
                        colSpan={4}
                        className="border px-2 py-1 text-sm text-gray-800"
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
          <div className="mt-4 flex items-center gap-2">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              onClick={handleSubmit}
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
