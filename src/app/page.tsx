import Formation from "@/components/Formation";
import Link from "next/link";
import JfaImportForm from "@/components/JfaImportForm";
import BackButton from "@/components/BackButton";
import type { Player } from "@/types/player";
import { getBaseUrl } from "@/lib/url";

async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch(`${getBaseUrl()}/api/players`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch players");
  }
  return (await res.json()) as Player[];
}

export default async function Home() {
  const players = await fetchPlayers();

  if (players.length === 0) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
        <JfaImportForm />
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">サッカー日本代表フォーメーション予想</h1>
      <div className="mb-4 space-x-4">
        <Link href="/players/new" className="text-yellow-300 underline">
          新規選手登録
        </Link>
        <Link href="/players" className="text-yellow-300 underline">
          選手一覧を編集
        </Link>
        <Link href="/admin/jfa-import" className="text-yellow-300 underline">
          JFAメンバーインポート
        </Link>
      </div>
      <Formation />
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}