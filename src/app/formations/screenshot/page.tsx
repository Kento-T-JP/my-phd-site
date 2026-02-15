"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Formation from "@/components/Formation";
import type { SavedFormation } from "@/types/formation";

function FormationScreenshotPageContent() {
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
    <main className="min-h-screen p-4 flex items-center justify-center">
      {formation ? (
        <Formation initialFormation={formation} screenshotMode />
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Loading...</p>
      )}
    </main>
  );
}

export default function FormationScreenshotPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <FormationScreenshotPageContent />
    </Suspense>
  );
}
