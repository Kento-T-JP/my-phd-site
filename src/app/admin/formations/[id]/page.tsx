"use client";
import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import PageMain from "@/components/PageMain";

type Formation = {
  id: number;
  name: string;
  userEmail: string;
  createdAt: string;
};

type Props = { params: Promise<{ id: string }> };

export default function FormationDetailPage({ params }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formation, setFormation] = useState<Formation | null>(null);
  const { id } = use(params);
  const formationId = Number(id);

  useEffect(() => {
    if (status === "authenticated") {
      fetch(`/api/admin/formations/${formationId}`).then(async (res) => {
        if (res.ok) {
          setFormation(await res.json());
        }
      });
    }
  }, [status, formationId]);

  if (status === "loading") {
    return (
      <PageMain className="p-4 sm:p-8">
        <p>Loading...</p>
      </PageMain>
    );
  }

  if (!session) {
    return (
      <PageMain className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </PageMain>
    );
  }

  if (!session.user?.isAdmin) {
    return (
      <PageMain className="p-4 sm:p-8">
        <p>Unauthorized</p>
      </PageMain>
    );
  }

  const handleDelete = async () => {
    if (!confirm("削除してもよろしいですか？")) return;
    await fetch(`/api/admin/formations/${formationId}`, { method: "DELETE" });
    router.push("/admin/formations");
  };

  return (
    <PageMain className="p-4 sm:p-8 space-y-4">
      {formation ? (
        <>
          <h1 className="text-xl font-bold">{formation.name}</h1>
          <p>Owner: {formation.userEmail}</p>
          <p>Created: {new Date(formation.createdAt).toLocaleString()}</p>
          <button onClick={handleDelete} className="text-red-600 underline">
            Delete
          </button>
        </>
      ) : (
        <p>Not found</p>
      )}
      <BackButton />
    </PageMain>
  );
}

