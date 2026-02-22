import type { Metadata } from "next";
import { LEGAL_VERSION } from "@/lib/legal";
import LegalPageActions from "@/components/LegalPageActions";

export const metadata: Metadata = {
  title: "利用規約",
  description: "Start XI 利用規約",
};

export default function TermsPage() {
  return (
    <main className="app-shell">
      <section className="glass-panel p-5 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold">利用規約</h1>
        <p className="text-sm text-cyan-100/70">最終更新日: {LEGAL_VERSION}</p>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. 適用</h2>
          <p className="text-sm text-cyan-100/85">
            本規約は、Start XI（以下「本サービス」）の利用条件を定めるものです。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. アカウント</h2>
          <p className="text-sm text-cyan-100/85">
            利用者は、登録情報を正確に保ち、認証情報を適切に管理する責任を負います。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. 禁止事項</h2>
          <p className="text-sm text-cyan-100/85">
            法令違反、不正アクセス、第三者の権利侵害、本サービス運営を妨害する行為を禁止します。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. サービス変更・停止</h2>
          <p className="text-sm text-cyan-100/85">
            本サービスは、保守や障害対応等のため、予告なく機能変更・停止する場合があります。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. 免責</h2>
          <p className="text-sm text-cyan-100/85">
            本サービスは現状有姿で提供され、継続性・完全性・特定目的適合性を保証しません。
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. 準拠法・管轄</h2>
          <p className="text-sm text-cyan-100/85">
            本規約は日本法に準拠し、本サービスに関する紛争は運営者所在地を管轄する裁判所を第一審の専属的合意管轄とします。
          </p>
        </section>
        <LegalPageActions />
      </section>
    </main>
  );
}
