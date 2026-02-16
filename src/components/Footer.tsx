"use client";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-shell text-xs text-left text-cyan-100/70 mt-16 pb-6">
      <div className="glass-panel p-4 sm:p-5 space-y-2">
        <p>
          本サイトで使用している一部画像は、公益財団法人 日本サッカー協会（JFA）公式サイト等の公開情報を元に掲載しております。
        </p>
        <p>
          著作権はすべてJFAおよび関係権利者に帰属しており、本サイトでの掲載は情報提供・紹介を目的としたものであり、商用利用・再配布を目的としたものではありません。
        </p>
        <p>
          万一、掲載内容に問題がある場合や、関係者様からの削除・修正依頼がありましたら、速やかに対処いたしますので、
          <Link href="/contact" className="underline decoration-cyan-300/70 underline-offset-2">
            お問い合わせフォーム
          </Link>
          よりご連絡ください。
        </p>
        <p className="pt-2 text-cyan-100/60">
          © {year} Start XI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
