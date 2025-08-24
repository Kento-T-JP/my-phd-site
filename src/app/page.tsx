import Formation from "@/components/Formation";
import JfaImportForm from "@/components/JfaImportForm";
import type { Player } from "@/types/player";
import { getBaseUrl } from "@/lib/url";
import { cookies } from "next/headers";

export async function fetchPlayers(): Promise<Player[]> {
  const cookieHeader = cookies().toString();
  const res = await fetch(`${getBaseUrl()}/api/players`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) {
    console.error(`Failed to fetch players: ${res.status} ${res.statusText}`);
    throw new Error("Failed to fetch players");
  }
  return (await res.json()) as Player[];
}

import type { SavedFormation } from "@/types/formation";

export default async function Home({
  searchParams,
}: {
  searchParams?: { formationId?: string };
}) {
  const players = await fetchPlayers();

  const formationId = searchParams?.formationId;
  let initialFormation: SavedFormation | undefined;
  if (formationId) {
    try {
      const cookieHeader = cookies().toString();
      const res = await fetch(
        `${getBaseUrl()}/api/formations/${formationId}`,
        {
          cache: "no-store",
          headers: { cookie: cookieHeader },
        }
      );
      if (res.ok) {
        initialFormation = (await res.json()) as SavedFormation;
      }
    } catch (error) {
      console.error(`Failed to fetch formation ${formationId}:`, error);
      // ignore errors and fall back to default
    }
  }

  if (players.length === 0) {
    return (
      <main className="p-4 sm:p-8 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
        <JfaImportForm />
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-4">Starting Eleven: Tactical Preview</h1>
      <Formation initialFormation={initialFormation} />
    </main>
  );
}
