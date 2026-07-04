import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vertex — Müşteri Bulma Otomasyonu",
  description: "AI destekli lead-gen dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
