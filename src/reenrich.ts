/**
 * Mevcut leadleri YENIDEN ZENGINLESTIRIR (website'i yeniden tarar) — enrichment
 * kurallari derinlestiginde (platform/blog/telif/ek-sosyaller) eski leadlere uygular.
 * LLM cagrisi YOK (sadece HTTP). Analizli leadlerin skorlarini da yeni enrichment'a
 * gore yeniden hesaplar (deterministik).
 * Kullanim: npm run reenrich [sektor]
 */
import { createStore } from "./core/storage.js";
import { enrichCompany } from "./modules/enricher/enrich.js";
import { computeScores } from "./core/scoring.js";
import { sectorFor } from "./core/services.js";
import { mapPool } from "./core/pool.js";
import { config } from "./core/config.js";

async function main() {
  const sectorArg = process.argv[2];
  const store = createStore();
  let targets = (await store.all()).filter((l) => l.raw.website);
  if (sectorArg) targets = targets.filter((l) => sectorFor(l.raw) === sectorArg);

  console.log(
    `\n${targets.length} lead yeniden zenginlestiriliyor${sectorArg ? ` (sektor: ${sectorArg})` : ""}` +
      ` (eszaman: ${config.enrichConcurrency})...\n`,
  );

  let ok = 0;
  let reachable = 0;
  await mapPool(targets, config.enrichConcurrency, async (lead) => {
    lead.enrichment = await enrichCompany(lead.raw);
    // Analizi olan leadin skorunu yeni enrichment'a gore tazele (LLM'siz).
    if (lead.analysis) {
      const s = computeScores(lead.raw, lead.enrichment, lead.analysis.budgetLevel, sectorFor(lead.raw));
      lead.analysis.leadScore = s.leadScore;
      lead.analysis.icpScore = s.icpScore;
      lead.analysis.urgencyScore = s.urgencyScore;
    }
    await store.save(lead);
    ok++;
    if (lead.enrichment.websiteReachable) reachable++;
    const p = lead.enrichment.tech.platform ? ` · ${lead.enrichment.tech.platform}` : "";
    console.log(`  ${lead.enrichment.websiteReachable ? "✓" : "·"} ${lead.raw.name}${p}`);
  });
  console.log(`\nBitti: ${ok} lead islendi, ${reachable} erisilebilir site.`);
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
