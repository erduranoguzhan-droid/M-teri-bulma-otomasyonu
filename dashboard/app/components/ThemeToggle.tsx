"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const cur = (document.documentElement.dataset.theme as "dark" | "light") || "dark";
    setTheme(cur);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* yok say */
    }
    setTheme(next);
  }

  return (
    <button className="theme-toggle" onClick={toggle} title="Tema değiştir" aria-label="Tema değiştir">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
