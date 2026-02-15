"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

export default function GoogleLoginPanel() {
  const { play } = useClickSound();

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="text-2xl font-bold mb-2">Google認証</h1>
        <p className="mb-6 text-sm text-cyan-100/80">
          初回はGoogleアカウントで認証を行い、その後ログイン画面に進みます。
        </p>
        <button
          type="button"
          className="primary-btn w-full"
          onClick={() => {
            play();
            void signIn("google", { callbackUrl: "/login" });
          }}
        >
          Googleで認証
        </button>
        <div className="mt-6 text-sm text-cyan-100/70">
          認証完了後、自動で次のログインステップへ遷移します。
        </div>
        <div className="mt-4 text-sm">
          <Link href="/contact" className="underline decoration-cyan-300/70 underline-offset-2 text-cyan-100/80">
            ログインできない場合のお問い合わせ
          </Link>
        </div>
      </section>
    </main>
  );
}
