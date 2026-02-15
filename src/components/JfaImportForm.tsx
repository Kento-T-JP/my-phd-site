"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useClickSound from "@/lib/useClickSound";

export default function JfaImportForm() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const { play } = useClickSound();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/jfa-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
      if (res.ok) {
        const linked =
          typeof data.linked === "number" ? data.linked : data.count;
        const processed =
          typeof data.count === "number" ? data.count : linked;
        setMessage(
          `${linked}人を反映しました（処理対象: ${processed}人）`
        );
        setTimeout(() => {
        router.push("/home");
        }, 1500);
      } else {
      setMessage(data.error || "エラーが発生しました");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md border border-cyan-300/35 bg-cyan-900/20 p-3">
          <p className="text-sm font-semibold text-cyan-100">
            召集メンバーのページを開き、取り込みたいページURLを入力してください。
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
            上記サイトで対象の召集メンバーを選択した後、そのページURLをそのまま貼り付けてください。
          </p>
        </div>
        <input
          type="text"
          className="w-full p-2 border rounded"
          placeholder="https://www.jfa.jp/samuraiblue/.../member.html"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button
          type="submit"
          className="px-4 py-2 bg-yellow-400 text-blue-900 rounded"
          onClick={play}
        >
          Fetch
        </button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
