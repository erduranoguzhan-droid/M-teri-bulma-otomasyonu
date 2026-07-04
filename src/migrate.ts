import { readFile } from "node:fs/promises";
import { SupabaseLeadStore } from "./core/storage.js";
import { DEFAULT_DB_PATH } from "./core/storage.js";
import type { Lead } from "./core/types.js";

/**
 * data/leads.json'daki tum leadleri Supabase'e tasir (upsert; tekrar calistirmak guvenli).
 * Kullanim: STORAGE_BACKEND=supabase gerekmez; direkt SupabaseLeadStore kullanir.
 *   npm run migrate
 */
async function main(): Promise<void> {
  const path = process.argv[2] ?? DEFAULT_DB_PATH;
  let leads: Lead[];
  try {
    leads = JSON.parse(await readFile(path, "utf8")) as Lead[];
  } catch (err) {
    console.error(`${path} okunamadi: ${(err as Error).message}`);
    process.exit(1);
  }

  const store = new SupabaseLeadStore();
  console.log(`${leads.length} lead Supabase'e tasiniyor...`);
  let ok = 0;
  for (const lead of leads) {
    try {
      await store.save(lead);
      ok++;
    } catch (err) {
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  }
  console.log(`Bitti: ${ok}/${leads.length} lead tasindi.`);
}

main().catch((err) => {
  console.error("\nHATA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
