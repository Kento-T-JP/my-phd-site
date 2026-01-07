"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import useClickSound from "@/lib/useClickSound";

export default function GoogleConsentPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { play } = useClickSound();
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }
    if (status === "authenticated") {
      if (session?.loginStage !== "google") {
        router.replace("/login");
        return;
      }
      if (session?.user?.googleEmailConsent) {
        router.replace("/login");
      }
    }
  }, [router, session?.loginStage, session?.user?.googleEmailConsent, status]);

  const handleConsent = async (consent: boolean) => {
    setIsSubmitting(true);
    setError("");
    const res = await fetch("/api/auth/google-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "更新に失敗しました");
      setIsSubmitting(false);
      return;
    }

    if (consent) {
      await update();
      router.push("/login");
      return;
    }

    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">メール利用の確認</h1>
      <p className="mb-4 text-sm text-white/80">
        Google認証が完了しました。以下のメールアドレスを本サービスで利用してよいか確認してください。
      </p>
      <div className="mb-4 p-3 border rounded text-sm">
        {session?.user?.email ?? "(メールアドレスを取得できません)"}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-1"
        />
        <span>このメールアドレスをサービスのアカウント連携に使用する</span>
      </label>
      {error && <p className="mt-3 text-red-600">{error}</p>}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          onClick={() => {
            play();
            void handleConsent(true);
          }}
          disabled={!consentChecked || isSubmitting}
        >
          はい、利用します
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 border rounded"
          onClick={() => {
            play();
            void handleConsent(false);
          }}
          disabled={isSubmitting}
        >
          いいえ、利用しません
        </button>
      </div>
    </main>
  );
}
