"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { SavedFormation } from "@/types/formation";

export default function FormationsPage() {
  const { data: session } = useSession();
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: number) => {
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((f) => f.id !== id));
  };

  if (!session) {
    return (
      <main className="p-8">
        <p>
          Please <Link href="/login">login</Link> to view your formations.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Saved Formations</h1>
      {loading ? (
        <p>Loading...</p>
      ) : list.length === 0 ? (
        <p>No formations saved.</p>
      ) : (
        <ul>
          {list.map((f) => (
            <li key={f.id} className="mb-2">
              <span className="mr-2">{f.name}</span>
              <Link
                href={`/?formationId=${f.id}`}
                className="underline mr-2"
              >
                Select
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
    </main>
  );
}
