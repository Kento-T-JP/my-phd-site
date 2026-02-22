"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

const statusCopy = {
  pending: {
    title: "利用資格を確認中です",
    description:
      "Google認証は完了しました。次にログインするか、利用資格の登録を行ってください。",
  },
  signedout: {
    title: "ログアウトしました",
    description:
      "再度利用する場合は、ログインまたは新規登録に進んでください。",
  },
  rejected: {
    title: "利用資格が承認されませんでした",
    description: "恐れ入りますが現在はご利用いただけません。詳細が必要な場合はお問い合わせください。",
  },
  gate: {
    title: "Google認証の許可メールではありません",
    description:
      "許可されたGoogleアカウントでログインしてください。現在のメールを確認して、再度お試しください。",
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

function AccessStatusPageContent() {
  const params = useSearchParams();
  const { data: session } = useSession();
  const { play } = useClickSound();
  const sessionUser = session?.user as { status?: string } | undefined;

  const rawStatus = params.get("status") ?? sessionUser?.status ?? "pending";
  const rawEmail = params.get("email");
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
      {status === "gate" && rawEmail && (
        <p className="mb-6 text-xs text-white/70">検出メール: {rawEmail}</p>
      )}
      <div className="space-y-3">
        {(status === "pending" || status === "signedout") && (
          <>
            <Link
              href="/login"
              className="block w-full text-center px-4 py-2 bg-blue-500 text-white rounded"
              onClick={play}
            >
              ログインする
            </Link>
            <Link
              href="/register"
              className="block w-full text-center px-4 py-2 border rounded"
              onClick={play}
            >
              初めての方はこちら（新規登録）
            </Link>
          </>
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
            void signOut({ callbackUrl: "/access-status?status=signedout" });
          }}
        >
          ログアウト
        </button>
      </div>
    </main>
  );
}

export default function AccessStatusPage() {
  return (
    <Suspense fallback={<main className="p-4 sm:p-8 max-w-md mx-auto"><p>Loading...</p></main>}>
      <AccessStatusPageContent />
    </Suspense>
  );
}
