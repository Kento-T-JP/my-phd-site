"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Formation from "@/components/Formation";
import type { SavedFormation } from "@/types/formation";

export default function FormationScreenshotPage() {
  const searchParams = useSearchParams();
  const formationId = searchParams.get("formationId");
  const [formation, setFormation] = useState<SavedFormation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!formationId) {
      setError("Formation not found");
      return;
    }
    const idNum = Number(formationId);
    if (Number.isNaN(idNum)) {
      setError("Formation not found");
      return;
    }
    fetch(`/api/formations/${idNum}`)
      .then((res) => {
        if (res.ok) return res.json();
        if (res.status === 401) {
          setError("You must be logged in");
          router.push("/login");
        } else {
          setError("Formation not found");
        }
        return null;
      })
      .then((data) => {
        if (data) setFormation(data);
      })
      .catch(() => {
        setError("Formation not found");
      });
  }, [formationId, router]);

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
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Loading...</p>
      )}
      <style jsx>{`
        .screenshot-wrapper > div > :not(#field-bench) {
          display: none;
        }
        #field-bench {
          display: flex;
          flex-direction: row-reverse;
        }
        #field-bench #bench {
          width: 200px;
          margin-top: 0;
          order: 1;
        }
        #field-bench #field {
          flex: 1;
          order: 2;
        }
      `}</style>
    </main>
  );
}

