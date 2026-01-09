"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

export default function GoogleLoginPanel() {
  const { play } = useClickSound();

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Googleログイン</h1>
      <p className="mb-6 text-sm text-white/80">
        まずはGoogleアカウントで認証してください。
      </p>
      <button
        type="button"
        className="w-full px-4 py-2 bg-red-500 text-white rounded"
        onClick={() => {
          play();
          void signIn("google", { callbackUrl: "/" });
        }}
      >
        Googleで認証
      </button>
      <div className="mt-6 text-sm text-white/80">
        Google認証後にログインします。
      </div>
    </main>
  );
}
