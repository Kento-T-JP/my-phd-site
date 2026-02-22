"use client";

import { useRouter } from "next/navigation";

export default function LegalPageActions() {
  const router = useRouter();

  return (
    <div className="pt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="ghost-btn text-sm"
        onClick={() => router.back()}
      >
        戻る
      </button>
    </div>
  );
}
