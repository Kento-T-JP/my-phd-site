"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { SavedFormation } from "@/types/formation";
import Formation from "@/components/Formation";

export default function FormationsPage() {
  const { data: session } = useSession();
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | "">("");

  async function loadList() {
    const res = await fetch("/api/formations");
    if (res.ok) {
      const data = (await res.json()) as SavedFormation[];
      setList(data);
      if (data.length > 0) {
        setSelectedId((prev) =>
          prev === "" ? data[0].id : prev
        );
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    loadList();
  }, [session]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? "" : prev));
  };

  const selectedFormation =
    selectedId === "" ? null : list.find((f) => f.id === selectedId) || null;

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
        <>
          <div className="mb-4">
            <select
              className="border p-1"
              value={selectedId}
              onChange={(e) =>
                setSelectedId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            >
              {list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {selectedId && (
              <button
                onClick={() => handleDelete(Number(selectedId))}
                className="ml-2 text-red-500 underline"
              >
                Delete
              </button>
            )}
          </div>
          {selectedFormation && (
            <Formation
              initialFormation={selectedFormation}
              onSaved={loadList}
              onUpdated={loadList}
            />
          )}
        </>
      )}
    </main>
  );
}
