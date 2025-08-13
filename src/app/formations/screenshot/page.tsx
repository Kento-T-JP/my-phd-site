"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Formation from "@/components/Formation";
import type { SavedFormation } from "@/types/formation";

export default function FormationScreenshotPage() {
  const searchParams = useSearchParams();
  const formationId = searchParams.get("formationId");
  const [formation, setFormation] = useState<SavedFormation | null>(null);

  useEffect(() => {
    if (!formationId) return;
    const idNum = Number(formationId);
    if (Number.isNaN(idNum)) return;
    fetch(`/api/formations/${idNum}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFormation(data))
      .catch(() => {});
  }, [formationId]);

  const requestFull = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    requestFull();
  }, []);

  return (
    <main className="p-4">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/formations" className="text-blue-500 underline">
          ← 戻る
        </Link>
        <button
          onClick={requestFull}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          端末のスクショ機能を使って撮影してください
        </button>
      </div>
      {formation ? (
        <div className="screenshot-wrapper">
          <Formation initialFormation={formation} />
        </div>
      ) : (
        <p>Loading...</p>
      )}
      <style jsx>{`
        .screenshot-wrapper > div > :not(#field-bench) {
          display: none;
        }
      `}</style>
    </main>
  );
}

