"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

type Formation = {
  id: number;
  name: string;
  userEmail: string;
  createdAt: string;
};

export default function AdminFormationsPage() {
  const { data: session, status } = useSession();
  const [formations, setFormations] = useState<Formation[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/formations").then(async (res) => {
        if (res.ok) {
          setFormations(await res.json());
        }
      });
    }
  }, [status]);

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

  if (!session.user?.isAdmin) {
    return (
      <main className="p-8">
        <p>Unauthorized</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Formations</h1>
      <table className="min-w-full border text-sm mb-4">
        <thead>
          <tr>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Owner</th>
            <th className="border px-2 py-1">Created</th>
          </tr>
        </thead>
        <tbody>
          {formations.map((f) => (
            <tr key={f.id}>
              <td className="border px-2 py-1">
                <Link href={`/admin/formations/${f.id}`} className="underline">
                  {f.name}
                </Link>
              </td>
              <td className="border px-2 py-1">{f.userEmail}</td>
              <td className="border px-2 py-1">
                {new Date(f.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <BackButton />
    </main>
  );
}

