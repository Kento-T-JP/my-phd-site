import { cookies } from "next/headers";
import { getBaseUrl } from "@/lib/url";
import type { Player } from "@/types/player";

export async function fetchPlayers(): Promise<Player[]> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/players`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) {
    console.error(`Failed to fetch players: ${res.status} ${res.statusText}`);
    throw new Error("Failed to fetch players");
  }
  return (await res.json()) as Player[];
}
