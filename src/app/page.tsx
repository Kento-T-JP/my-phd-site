import Formation from "@/components/Formation";
import Link from "next/link";
import JfaImportPage from "./admin/jfa-import/page";
import type { Player } from "@/types/player";

async function fetchPlayers(): Promise<Player[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/players`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch players");
  }
  return (await res.json()) as Player[];
}

export default async function Home() {
  const players = await fetchPlayers();

  if (players.length === 0) {
    return <JfaImportPage />;
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">サッカー日本代表フォーメーション予想</h1>
      <div className="mb-4 space-x-4">
        <Link href="/players/new" className="text-blue-600 underline">
          新規選手登録
        </Link>
        <Link href="/admin/jfa-import" className="text-blue-600 underline">
          JFAメンバーインポート
        </Link>
      </div>
      <Formation />
    </main>
  );
}