"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="text-xs text-center text-gray-400 mt-16 p-4">
      <p>
        本サイトで使用している一部画像は、公益財団法人 日本サッカー協会（JFA）公式サイト等の公開情報を元に掲載しております。
      </p>
      <p>
        著作権はすべてJFAおよび関係権利者に帰属しており、本サイトでの掲載は情報提供・紹介を目的としたものであり、商用利用・再配布を目的としたものではありません。
      </p>
      <p>
        万一、掲載内容に問題がある場合や、関係者様からの削除・修正依頼がありましたら、速やかに対処いたしますので、
        <Link href="/contact" className="underline">お問い合わせフォーム</Link>
        よりご連絡ください。
      </p>
    </footer>
  );
}
