"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import CollaborativeFormationEditor from "@/components/CollaborativeFormationEditor";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { SavedFormation } from "@/types/formation";

export default function CollaborativeFormationPage() {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const [formation, setFormation] = useState<SavedFormation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }

    const formationId = Number(params.id);
    if (Number.isNaN(formationId)) {
      setError("フォーメーションIDが不正です。");
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/formations/${formationId}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as
          | SavedFormation
          | { error?: string }
          | null;
        if (!res.ok) {
          setError(
            data && typeof data === "object" && "error" in data && typeof data.error === "string"
              ? data.error
              : "フォーメーションの取得に失敗しました。"
          );
          setFormation(null);
          return;
        }
        setFormation(data as SavedFormation);
      } catch {
        setError("フォーメーションの取得に失敗しました。");
        setFormation(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.id, session, status]);

  if (status === "loading" || loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view collaborative formations.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Collaborative Formation</h1>
          <p className="text-sm text-cyan-100/75">
            共同編集専用ページです。変更はリアルタイム共有されますが、通常フォーメーションとして保存するまで恒久保存はされません。
          </p>
        </div>
        <Link
          href={`/formations?formationId=${params.id}`}
          className="inline-flex items-center rounded border border-cyan-300/30 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/10"
        >
          通常一覧に戻る
        </Link>
      </div>
      {error ? (
        <p className="text-red-300">{error}</p>
      ) : formation ? (
        <CollaborativeFormationEditor
          initialFormation={formation}
          onUpdated={(updated) => {
            if (updated) {
              setFormation(updated);
            }
          }}
        />
      ) : (
        <p>フォーメーションが見つかりません。</p>
      )}
    </main>
  );
}
