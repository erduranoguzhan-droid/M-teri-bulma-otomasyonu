"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "🎯 Kokpit" },
  { href: "/scans", label: "🗂️ Taramalar" },
  { href: "/insights", label: "📊 Insights" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <div className="navbar">
      <nav className="topnav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`topnav-link${isActive(l.href) ? " on" : ""}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <ThemeToggle />
    </div>
  );
}
