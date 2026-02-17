"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

export default function GoogleLoginPanel() {
  const { play } = useClickSound();

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="text-2xl font-bold mb-2">Start XI</h1>
        <p className="mb-5 text-sm text-cyan-100/80">
          Start XI は、サッカーのフォーメーション設計・選手管理・ロスター運用を一つの画面で進めるための戦術プラットフォームです。
        </p>
        <ul className="mb-6 space-y-1 text-xs text-cyan-100/75">
          <li>・フォーメーション作成と保存</li>
          <li>・選手データの登録 / 編集 / インポート</li>
          <li>・大会 / ロスター単位での管理</li>
        </ul>
        <button
          type="button"
          className="primary-btn w-full"
          onClick={() => {
            play();
            void signIn("google", { callbackUrl: "/login" });
          }}
        >
          Continue with Google
        </button>
        <div className="mt-6 text-sm text-cyan-100/70">
          初回認証後、自動で次のログインステップへ進みます。
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
