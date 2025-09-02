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
      setMessage(`${data.count}人登録しました`);
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } else {
      setMessage(data.error || "エラーが発生しました");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
