"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SavedFormation } from "@/types/formation";
import Formation from "@/components/Formation";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function FormationsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const formationId = searchParams.get("formationId");
  const [list, setList] = useState<SavedFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | "">("");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/formations");
    if (res.ok) {
      const data = (await res.json()) as SavedFormation[];
      setList(data);
      if (data.length > 0) {
        setSelectedId((prev) => {
          if (prev !== "") return prev;
          const paramId = formationId ? Number(formationId) : NaN;
          if (!Number.isNaN(paramId) && data.some((f) => f.id === paramId)) {
            return paramId;
          }
          return data[0].id;
        });
      }
    }
    setLoading(false);
  }, [formationId]);

  useEffect(() => {
    if (!session) return;
    loadList();
  }, [session, loadList]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? "" : prev));
  };

  const handleSaved = (saved: SavedFormation) => {
    setList((prev) => [...prev, saved]);
    setSelectedId(saved.id);
  };

  const selectedFormation =
    selectedId === "" ? null : list.find((f) => f.id === selectedId) || null;

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view your formations.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-4">Saved Formations</h1>
      {loading ? (
        <LoadingSpinner />
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
              onSaved={handleSaved}
              onUpdated={loadList}
            />
          )}
        </>
      )}
    </main>
  );
}
