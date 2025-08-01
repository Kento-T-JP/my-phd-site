"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { SavedFormation } from "@/types/formation";
import type { Player } from "@/types/player";
import BackButton from "@/components/BackButton";
import WikiLink from "@/components/WikiLink";

interface FormationData {
  id: number;
  name: string;
  positions: any;
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Player[]>([]);
  const [favLoading, setFavLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    async function load() {
      const res = await fetch("/api/formations");
      if (res.ok) {
        setList((await res.json()) as SavedFormation[]);
      }
      setLoading(false);
    }
    load();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadFavorites() {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        setFavorites((await res.json()) as Player[]);
      }
      setFavLoading(false);
    }
    loadFavorites();
  }, [session]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this formation?")) return;
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((f) => f.id !== id));
  };

  if (status === "loading") {
    return (
      <main className="p-8">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">My Page</h1>
      <p className="mb-4">Email: {session.user?.email}</p>
      <h2 className="text-lg font-bold mb-2">Saved Formations</h2>
      {loading ? (
        <p>Loading...</p>
      ) : list.length === 0 ? (
        <p>No formations saved.</p>
      ) : (
        <ul>
          {list.map((f) => (
            <li key={f.id} className="mb-2">
              <Link href={`/?formationId=${f.id}`} className="underline mr-2">
                {f.name}
              </Link>
              <button
                onClick={() => handleDelete(f.id)}
                className="text-red-500 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-bold mt-4 mb-2">Favorite Players</h2>
      {favLoading ? (
        <p>Loading...</p>
      ) : favorites.length === 0 ? (
        <p>No favorite players.</p>
      ) : (
        <ul>
          {favorites.map((p) => (
            <li key={p.id} className="mb-2">
              <span className="mr-2">{p.number ?? "-"}</span>
              <span className="flex items-center">
                {p.name}
                <WikiLink name={p.name} wikiUrl={p.wikiUrl} className="ml-1" />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
