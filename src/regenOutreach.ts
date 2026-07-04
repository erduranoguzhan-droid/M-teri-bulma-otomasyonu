/**
 * Mevcut leadlerin outreach mesajlarini YENIDEN URETIR (or. ton kurallari degisince).
 * Kullanim:
 *   npm run outreach:regen                 -> tum analizli leadler
 *   npm run outreach:regen -- uretim-sanayi -> sadece o sektor
 * LLM cagrisi yapar (Max/API). Eszamanlilik havuzuyla + retry/backoff.
 */
import { createStore } from "./core/storage.js";
import { generateOutreach } from "./modules/outreach/generate.js";
import { sectorFor } from "./core/services.js";
import { mapPool } from "./core/pool.js";
import { config } from "./core/config.js";

async function main() {
  const sectorArg = process.argv[2];
  const store = createStore();
  let targets = (await store.all()).filter((l) => l.analysis);
  if (sectorArg) targets = targets.filter((l) => sectorFor(l.raw) === sectorArg);

  console.log(
    `\n${targets.length} lead icin outreach yeniden uretiliyor` +
      `${sectorArg ? ` (sektor: ${sectorArg})` : ""} (eszaman: ${config.llmConcurrency})...\n`,
  );

  let ok = 0;
  let fail = 0;
  await mapPool(targets, config.llmConcurrency, async (lead) => {
    try {
      const sec = sectorFor(lead.raw);
      lead.outreach = await generateOutreach(lead.raw, lead.analysis!, sec);
      lead.stage = "outreach_ready";
      await store.save(lead);
      ok++;
      console.log(`  ✓ [${sec}] ${lead.raw.name}`);
    } catch (err) {
      fail++;
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  });
  console.log(`\nBitti: ${ok} tamam, ${fail} hata.`);
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
