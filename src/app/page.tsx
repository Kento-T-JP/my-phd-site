import Formation from "@/components/Formation";
import Link from "next/link";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">サッカー日本代表フォーメーション予想</h1>
      <div className="mb-4 space-x-4">
        <Link href="/players/new" className="text-blue-600 underline">
          新規選手登録
        </Link>
        <Link href="/admin/jfa-import" className="text-blue-600 underline">
          JFAメンバーインポート
        </Link>
      </div>
      <Formation />
    </main>
  );
}