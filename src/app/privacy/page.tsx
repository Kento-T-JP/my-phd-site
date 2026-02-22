import type { Metadata } from "next";
import { LEGAL_VERSION } from "@/lib/legal";
import LegalPageActions from "@/components/LegalPageActions";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Start XI プライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <main className="app-shell">
      <section className="glass-panel p-5 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
        <p className="text-sm text-cyan-100/70">最終更新日: {LEGAL_VERSION}</p>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. 取得する情報</h2>
          <p className="text-sm text-cyan-100/85">
            メールアドレス、認証情報、操作ログ、問い合わせ内容等を取得します。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. 利用目的</h2>
          <p className="text-sm text-cyan-100/85">
            アカウント管理、サービス提供、不正利用防止、品質改善、問い合わせ対応のために利用します。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. 第三者提供</h2>
          <p className="text-sm text-cyan-100/85">
            法令に基づく場合を除き、本人の同意なく個人情報を第三者へ提供しません。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. 外部サービス</h2>
          <p className="text-sm text-cyan-100/85">
            reCAPTCHA、メール送信、分析基盤等の外部サービスを利用する場合があります。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. 保管期間</h2>
          <p className="text-sm text-cyan-100/85">
            目的達成に必要な期間保持し、不要となった情報は合理的な範囲で削除します。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. 問い合わせ窓口</h2>
          <p className="text-sm text-cyan-100/85">
            個人情報に関する問い合わせは、サイト内のお問い合わせフォームから受け付けます。
          </p>
        </section>
        <LegalPageActions />
      </section>
    </main>
  );
}
