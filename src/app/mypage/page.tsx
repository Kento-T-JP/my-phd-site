"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface FormationData {
  id: number;
  name: string;
  positions: any;
}

export default function MyPage() {
  const { data: session, status } = useSession();
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
              <Link href={`/?formationId=${f.id}`} className="underline">
                {f.name}
              </Link>
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
