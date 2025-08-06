import Link from "next/link";

interface HomeNavProps {
  isAdmin?: boolean;
}

export default function HomeNav({ isAdmin = false }: HomeNavProps) {
  const links = [
    { href: "/players/new", label: "新規選手登録" },
    { href: "/players", label: "選手一覧を編集" },
    { href: "/admin/jfa-import", label: "JFAメンバーインポート" },
    { href: "/contact", label: "お問い合わせ" },
  ];

  return (
    <nav className="mb-6">
      <ul className="flex flex-wrap items-center gap-4 bg-blue-900/50 border border-cyan-400/20 px-4 py-2 rounded-md backdrop-blur-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-yellow-300 hover:text-white hover:underline transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
        {isAdmin && (
          <li>
            <Link
              href="/admin"
              className="text-yellow-300 hover:text-white hover:underline transition-colors"
            >
              管理者画面
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

