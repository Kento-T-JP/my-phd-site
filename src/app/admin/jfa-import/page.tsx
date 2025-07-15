"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JfaImportPage() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

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
        router.push('/');
      }, 1500);
    } else {
      setMessage(data.error || "エラーが発生しました");
    }
  };

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          className="w-full p-2 border rounded"
          placeholder="https://www.jfa.jp/samuraiblue/.../member.html"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Fetch
        </button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}
