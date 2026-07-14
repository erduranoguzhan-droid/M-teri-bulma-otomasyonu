"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "🎯 Kokpit" },
  { href: "/insights", label: "📊 Insights" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="topnav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`topnav-link${pathname === l.href ? " on" : ""}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
