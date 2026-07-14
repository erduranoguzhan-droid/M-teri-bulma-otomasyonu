/**
 * Mevcut FIRMA-MODU leadlerine rakip analizi ekler/yeniler — tam yeniden tarama YAPMADAN.
 * Lead'in kayitli intelligence'ini (teknoloji/olgunluk) kullanir; yalniz RAKIPLERI taze tarar.
 * Kullanim:
 *   npm run competitors                        # rakip analizi olmayan tum firma leadleri
 *   npm run competitors -- --force             # hepsini yeniden analiz et
 *   npm run competitors -- --max-competitors 3 --lang tr
 */
import { createStore } from "./core/storage.js";
import { computeIntelScores, type CompanyIntelligence } from "./core/intelligence.js";
import { runCompetitorAnalysis } from "./modules/analyzer/competitors.js";
import type { DeepEnrichResult } from "./modules/enricher/deepEnrich.js";
import type { Enrichment } from "./core/types.js";

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const force = process.argv.includes("--force");
  const maxCompetitors = Number(argVal("--max-competitors")) || 4;
  const lang = (argVal("--lang") === "en" ? "en" : "tr") as "tr" | "en";

  const store = createStore();
  const leads = await store.all();
  const targets = leads.filter(
    (l) => l.scanMode === "company" && l.intelligence && (force || !l.intelligence.competitors),
  );
  console.log(`\n${targets.length} firma leadine rakip analizi ${force ? "(yeniden) " : ""}uygulaniyor...\n`);

  let ok = 0;
  for (const lead of targets) {
    try {
      const intel = lead.intelligence!;
      const deep = synthDeep(intel, lead.enrichment);
      const competitors = await runCompetitorAnalysis({
        raw: lead.raw, deep, intel, max: maxCompetitors, lang,
      });
      intel.competitors = competitors;
      intel.scores = computeIntelScores({
        raw: lead.raw,
        enrichment: lead.enrichment,
        tech: intel.technologies,
        contacts: intel.contacts,
        signals: intel.signals,
        competitivePressure: competitors.competitivePressureScore,
      });
      await store.save(lead);
      ok++;
      console.log(`  ✓ ${lead.raw.name} → ${competitors.competitors.length} rakip, baski ${competitors.competitivePressureScore}`);
    } catch (err) {
      console.warn(`  ! ${lead.raw.name}: ${(err as Error).message}`);
    }
  }
  console.log(`\nBitti: ${ok}/${targets.length} lead islendi.`);
}

/** Kayitli intelligence'tan runCompetitorAnalysis icin minimal DeepEnrichResult kurar (lead yeniden taranmaz). */
function synthDeep(intel: CompanyIntelligence, enrichment: Enrichment | undefined): DeepEnrichResult {
  const e = enrichment ?? emptyEnrichment();
  const pageTexts = e.pageTextSnippet ? [{ label: "home", url: "", text: e.pageTextSnippet }] : [];
  return {
    enrichment: e,
    technologies: intel.technologies,
    contacts: intel.contacts,
    signals: intel.signals,
    pageTexts,
    sources: intel.sources,
  };
}

function emptyEnrichment(): Enrichment {
  return {
    websiteReachable: false,
    emails: [],
    socials: {},
    tech: {
      hasGoogleAnalytics: false, hasMetaPixel: false, hasGoogleTagManager: false, hasWhatsApp: false,
      hasOnlineOrdering: false, hasReservation: false, hasLiveChat: false, hasBlog: false,
    },
  };
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
