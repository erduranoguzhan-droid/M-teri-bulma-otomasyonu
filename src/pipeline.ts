import type { LeadStore } from "./core/storage.js";
import type { Lead } from "./core/types.js";
import { config } from "./core/config.js";
import { mapPool } from "./core/pool.js";
import { findCompanies } from "./modules/finder/googleMaps.js";
import { enrichCompany } from "./modules/enricher/enrich.js";
import { analyzeCompany } from "./modules/analyzer/analyze.js";
import { generateOutreach } from "./modules/outreach/generate.js";

/** BUL: Google Maps'ten firma cek, store'a ekle. */
export async function runFind(
  store: LeadStore,
  query: string,
  max: number,
): Promise<Lead[]> {
  console.log(`\n[BUL] "${query}" araniyor (maks ${max})...`);
  const companies = await findCompanies({ query, maxResults: max });
  const leads: Lead[] = [];
  for (const c of companies) {
    leads.push(await store.upsertRaw(c));
  }
  console.log(`[BUL] ${leads.length} firma kaydedildi.`);
  return leads;
}

/** ZENGINLESTIR: website tarama + tech tespiti. Paralel (ag I/O). */
export async function runEnrich(store: LeadStore): Promise<void> {
  const targets = (await store.all()).filter((l) => l.stage === "found");
  console.log(`\n[ZENGINLESTIR] ${targets.length} firma islenecek (eszaman: ${config.enrichConcurrency})...`);
  let ok = 0;
  let fail = 0;
  await mapPool(targets, config.enrichConcurrency, async (lead) => {
    try {
      lead.enrichment = await enrichCompany(lead.raw);
      lead.stage = "enriched";
      await store.save(lead);
      ok++;
      const mark = lead.enrichment.websiteReachable ? "✓ website" : "· website yok/erisilemedi";
      console.log(`  ${mark}  ${lead.raw.name}`);
    } catch (err) {
      fail++;
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  });
  console.log(`[ZENGINLESTIR] bitti: ${ok} tamam, ${fail} hata.`);
}

/** ANALIZ: Claude ile problem tespiti + hizmet eslestirme + skorlar. */
export async function runAnalyze(store: LeadStore): Promise<void> {
  const targets = (await store.all()).filter((l) => l.stage === "enriched");
  console.log(`\n[ANALIZ] ${targets.length} firma analiz edilecek (eszaman: ${config.llmConcurrency})...`);
  let ok = 0;
  let fail = 0;
  await mapPool(targets, config.llmConcurrency, async (lead) => {
    try {
      lead.analysis = await analyzeCompany(lead.raw, lead.enrichment);
      lead.stage = "analyzed";
      await store.save(lead);
      ok++;
      console.log(
        `  Score ${lead.analysis.leadScore} | ${lead.raw.name} → ${lead.analysis.recommendedServices[0] ?? "-"}`,
      );
    } catch (err) {
      fail++;
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  });
  console.log(`[ANALIZ] bitti: ${ok} tamam, ${fail} hata.`);
}

/** TEKLIF: kisisellestirilmis outreach taslaklari. */
export async function runOutreach(store: LeadStore): Promise<void> {
  const targets = (await store.all()).filter((l) => l.stage === "analyzed" && l.analysis);
  console.log(`\n[TEKLIF] ${targets.length} firma icin mesaj uretilecek (eszaman: ${config.llmConcurrency})...`);
  let ok = 0;
  let fail = 0;
  await mapPool(targets, config.llmConcurrency, async (lead) => {
    try {
      lead.outreach = await generateOutreach(lead.raw, lead.analysis!);
      lead.stage = "outreach_ready";
      await store.save(lead);
      ok++;
      console.log(`  ✓ ${lead.raw.name}`);
    } catch (err) {
      fail++;
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  });
  console.log(`[TEKLIF] bitti: ${ok} tamam, ${fail} hata.`);
}

/** Tum cekirdek dongu: BUL → ZENGINLESTIR → ANALIZ → TEKLIF. */
export async function runPipeline(
  store: LeadStore,
  query: string,
  max: number,
): Promise<void> {
  await runFind(store, query, max);
  await runEnrich(store);
  await runAnalyze(store);
  await runOutreach(store);
  console.log("\n[BITTI] Cekirdek dongu tamamlandi. Sonuclar: npm run list");
}
