import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/Nav";

export const metadata: Metadata = {
  title: "Vertex — Müşteri Bulma Otomasyonu",
  description: "AI destekli lead-gen dashboard",
};

// Boyamadan once temayi ayarla (FOUC yok). Varsayilan: dark.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='light')?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="wrap">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
