import Link from "next/link";
import WikiLink from "@/components/WikiLink";
import type { Player } from "@/types/player";
import { getBaseUrl } from "@/lib/url";
import BackButton from "@/components/BackButton";

async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch(`${getBaseUrl()}/api/players`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch players");
  }
  return (await res.json()) as Player[];
}

export default async function PlayersPage() {
  const players = await fetchPlayers();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">選手一覧を編集</h1>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border-b px-2 py-1 text-left">背番号</th>
            <th className="border-b px-2 py-1 text-left">名前</th>
            <th className="border-b px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="px-2 py-1">{p.number ?? "-"}</td>
              <td className="px-2 py-1 text-white">
                <span className="flex items-center">
                  {p.name}
                  <WikiLink name={p.name} className="ml-1" />
                </span>
              </td>
              <td className="px-2 py-1 text-right">
                <Link href={`/players/${p.id}/edit`} className="text-yellow-300 underline">
                  編集
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
