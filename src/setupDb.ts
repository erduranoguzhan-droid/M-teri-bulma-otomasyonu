/**
 * Semayi dogrudan Postgres'e baglanip kurar (DDL).
 * Kullanim: DATABASE_URL=... tsx src/setupDb.ts
 * Baglanti adresi: Supabase > Settings > Database > Connection string > Session pooler (URI).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL yok. Ornek: DATABASE_URL='postgresql://...' tsx src/setupDb.ts");
    process.exit(1);
  }
  const sql = readFileSync(resolve("supabase/schema.sql"), "utf8");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Baglandi. Sema kuruluyor...");
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name='leads'"
  );
  console.log(rows.length ? "OK: 'leads' tablosu hazir." : "UYARI: tablo bulunamadi.");
  await client.end();
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
