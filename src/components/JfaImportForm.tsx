"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useClickSound from "@/lib/useClickSound";

export default function JfaImportForm() {
  const [url, setUrl] = useState("");
  const [skipExisting, setSkipExisting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const router = useRouter();
  const { play } = useClickSound();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImporting) return;
    setMessage(null);
    setImportStatus("JFAページを確認しています...");
    setIsImporting(true);
    try {
      const res = await fetch("/api/jfa-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, skipExisting }),
      });
      setImportStatus("選手データを反映しています...");
      const data = await res.json();
      if (res.ok) {
        const linked =
          typeof data.linked === "number" ? data.linked : data.count;
        const processed = typeof data.count === "number" ? data.count : linked;
        const requested =
          typeof data.requested === "number" ? data.requested : processed;
        const created = typeof data.created === "number" ? data.created : 0;
        const updated = typeof data.updated === "number" ? data.updated : 0;
        const restored = typeof data.restored === "number" ? data.restored : 0;
        const skipped = typeof data.skipped === "number" ? data.skipped : 0;
        setMessage(
          `${linked}人を反映しました（対象: ${requested} / 処理: ${processed} / 新規: ${created} / 上書き更新: ${updated} / 復元: ${restored} / 更新見送り: ${skipped}）`
        );
        setTimeout(() => {
          router.push("/home");
        }, 1500);
      } else {
        setMessage(data.error || "エラーが発生しました");
      }
    } catch {
      setMessage("通信エラーが発生しました");
    } finally {
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md border border-cyan-300/35 bg-cyan-900/20 p-3">
          <p className="text-sm font-semibold text-cyan-100">
            取り込みたい召集メンバーのページURLを入力してください。
          </p>
          <p className="mt-2 text-xs text-cyan-100/80">
            URLがわからない場合は、まず以下を試してください。
          </p>
          <a
            href="https://www.jfa.jp/samuraiblue/20251014/member.html"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm font-medium text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
          >
            2025/10/14 日本代表 vs ブラジル代表 のメンバーURL
          </a>
          <p className="mt-2 text-xs text-cyan-100/80">
            他の試合を探す場合は、以下の一覧ページから対象試合を開き、
            `member.html` のURLを貼り付けてください。
          </p>
          <a
            href="https://www.jfa.jp/samuraiblue_2025/member/"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          >
            https://www.jfa.jp/samuraiblue_2025/member/
          </a>
          <p className="mt-1 text-xs text-cyan-100/75">
            例: `https://www.jfa.jp/samuraiblue/20251014/member.html`
          </p>
        </div>
        <input
          type="text"
          className="w-full p-2 border rounded"
          placeholder="https://www.jfa.jp/samuraiblue/.../member.html"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isImporting}
          required
        />
        <label className="flex items-center gap-2 text-sm text-cyan-100/90">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={(e) => setSkipExisting(e.target.checked)}
            disabled={isImporting}
          />
          同じ名前の選手は上書き更新しない（既存データを維持）
        </label>
        <p className="text-xs text-cyan-100/70">
          既定では、同じ名前の選手は既存データを上書き更新します。
        </p>
        <button
          type="submit"
          className="px-4 py-2 bg-yellow-400 text-blue-900 rounded disabled:opacity-60"
          onClick={play}
          disabled={isImporting}
        >
          {isImporting ? "Import中..." : "Fetch"}
        </button>
      </form>
      {importStatus && (
        <p className="mt-3 text-sm text-cyan-200 animate-pulse">{importStatus}</p>
      )}
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
