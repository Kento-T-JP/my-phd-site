"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

const allowedGoogleEmail = "japan.start11@gmail.com";

export default function GoogleLoginPanel() {
  const { play } = useClickSound();

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Googleログイン</h1>
      <p className="mb-6 text-sm text-white/80">
        ログインには <span className="font-semibold">{allowedGoogleEmail}</span> を使用してください。
      </p>
      <button
        type="button"
        className="w-full px-4 py-2 bg-red-500 text-white rounded"
        onClick={() => {
          play();
          void signIn("google", { callbackUrl: "/login" });
        }}
      >
        Googleアカウントでログイン
      </button>
      <div className="mt-6 text-sm text-white/80">
        既存のログイン方式を利用する場合は
        <Link href="/login" className="ml-1 underline">
          こちら
        </Link>
        からログインしてください。
      </div>
    </main>
  );
}
