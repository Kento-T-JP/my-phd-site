"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

const statusCopy = {
  pending: {
    title: "利用資格を確認中です",
    description: "Google認証は完了しましたが、利用資格の確認が必要です。登録や審査の完了までお待ちください。",
  },
  rejected: {
    title: "利用資格が承認されませんでした",
    description: "恐れ入りますが現在はご利用いただけません。詳細が必要な場合はお問い合わせください。",
  },
  unknown: {
    title: "利用資格を確認できませんでした",
    description: "アカウント状態を確認できませんでした。時間を置いて再度お試しください。",
  },
  active: {
    title: "利用資格が確認できました",
    description: "ご利用準備が整いました。ホーム画面へ進んでください。",
  },
};

type StatusKey = keyof typeof statusCopy;

export default function AccessStatusPage() {
  const params = useSearchParams();
  const { data: session } = useSession();
  const { play } = useClickSound();

  const rawStatus = params.get("status") ?? session?.user?.status ?? "pending";
  const status = (Object.keys(statusCopy) as StatusKey[]).includes(
    rawStatus as StatusKey
  )
    ? (rawStatus as StatusKey)
    : "unknown";

  const content = statusCopy[status];

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{content.title}</h1>
      <p className="mb-6 text-sm text-white/80">{content.description}</p>
      <div className="space-y-3">
        {status === "pending" && (
          <Link
            href="/register"
            className="block w-full text-center px-4 py-2 bg-blue-500 text-white rounded"
            onClick={play}
          >
            利用資格を登録する
          </Link>
        )}
        {status === "rejected" && (
          <Link
            href="/contact"
            className="block w-full text-center px-4 py-2 bg-blue-500 text-white rounded"
            onClick={play}
          >
            問い合わせる
          </Link>
        )}
        {status === "active" && (
          <Link
            href="/home"
            className="block w-full text-center px-4 py-2 bg-blue-500 text-white rounded"
            onClick={play}
          >
            ホームへ進む
          </Link>
        )}
        <button
          type="button"
          className="w-full px-4 py-2 border rounded"
          onClick={() => {
            play();
            void signOut({ callbackUrl: "/" });
          }}
        >
          ログアウト
        </button>
      </div>
    </main>
  );
}
