"use client";

import { useState } from "react";
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
  const [players, setPlayers] = useState<ImportedPlayer[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
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
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const togglePlayer = (index: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)),
    );
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存に失敗しました");
      }
      const data = await res.json();
      setMessage(`${data.count}件の選手を保存しました`);
      setPlayers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">選手インポート</h1>
      <div>
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}
      {players.length > 0 && (
        <div>
          <table className="w-full border border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">選択</th>
                <th className="border px-2 py-1">名前</th>
                <th className="border px-2 py-1">ポジション</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => togglePlayer(idx)}
                    />
                  </td>
                  <td className="border px-2 py-1">{p.name}</td>
                  <td className="border px-2 py-1">{p.position.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            onClick={handleSubmit}
            disabled={saving}
          >
            インポートを確定
          </button>
        </div>
      )}
      <BackButton />
    </main>
  );
}

