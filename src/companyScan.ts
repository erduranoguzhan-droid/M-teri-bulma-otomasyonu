import { readFile } from "node:fs/promises";
import { createStore } from "./core/storage.js";
import { config } from "./core/config.js";
import { mapPool } from "./core/pool.js";
import { writeScanStatus, type CompanyScanItem, type ScanStatus } from "./core/scanStatus.js";
import { findCompanyByName } from "./modules/finder/byName.js";
import { deepEnrichCompany } from "./modules/enricher/deepEnrich.js";
import { analyzeIntelligence } from "./modules/analyzer/intelligence.js";
import { runCompetitorAnalysis } from "./modules/analyzer/competitors.js";
import type { Analysis, Outreach } from "./core/types.js";
import { computeIntelScores, type CompanyIntelligence, type ScanDepth } from "./core/intelligence.js";

/**
 * FIRMA-BAZLI AI Intelligence tarama. Tek/coklu firma adi veya CSV alir; her firma icin
 * bul -> derin enrich -> AI intelligence uretir. Firma-basi ilerlemeyi scan-status.json'a yazar.
 *
 * Ornek:
 *   npm run scan:company -- --names "Pfizer Türkiye, Acıbadem, Trendyol" --country "Türkiye" --depth standard
 *   npm run scan:company -- --csv data/firmalar.csv --max 50
 */
interface CompanyArgs {
  names: string[];
  country?: string;
  city?: string;
  lang: "tr" | "en";
  max: number;
  depth: ScanDepth;
  competitors: string[]; // elle verilen rakip adlari (opsiyonel)
  maxCompetitors: number; // firma-basi rakip ust siniri
  withCompetitors: boolean; // rakip analizi calissin mi (deep'te otomatik acik)
}

async function main(): Promise<void> {
  const args = await parseArgs(process.argv.slice(2));
  if (args.names.length === 0) {
    console.error('Firma adi gerekli. Ornek: npm run scan:company -- --names "Pfizer, Trendyol"');
    process.exit(1);
  }

  const store = createStore();
  const items: CompanyScanItem[] = args.names.map((name) => ({ name, phase: "waiting" }));
  const status: ScanStatus = {
    running: true,
    phase: "find",
    mode: "company",
    startedAt: new Date().toISOString(),
    queries: args.names,
    queryIndex: 0,
    queryTotal: args.names.length,
    found: 0,
    items,
  };
  await writeScanStatus(status);
  console.log(`\n[COMPANY-SCAN] ${args.names.length} firma, derinlik: ${args.depth}\n  ${args.names.join("\n  ")}`);

  // LLM eszamanliligi: CLI/Max seri (rate-limit), API paralel.
  const concurrency = config.llmConcurrency;
  let done = 0;

  await mapPool(items, concurrency, async (item) => {
    try {
      await setItem(status, item, "searching");
      const raw = await findCompanyByName({ name: item.name, country: args.country, city: args.city });

      await setItem(status, item, "scraping");
      const deep = await deepEnrichCompany(raw);

      await setItem(status, item, "enriching");
      // (deep enrich zaten yapildi; asama etiketi kullanici gorunurlugu icin)

      await setItem(status, item, "ai_analyzing");
      const intel = await analyzeIntelligence(raw, deep, { depth: args.depth, language: args.lang });

      // Rakip analizi (opsiyonel/additive): rakipleri gercekten tarar, matris + baskiyi uretir,
      // rakip baskisini urgency/priority skorlarina additive besler.
      if (args.withCompetitors) {
        await setItem(status, item, "competitor_analyzing");
        const competitors = await runCompetitorAnalysis({
          raw, deep, intel,
          userNames: args.competitors,
          max: args.maxCompetitors,
          lang: args.lang,
        });
        intel.competitors = competitors;
        intel.scores = computeIntelScores({
          raw,
          enrichment: deep.enrichment,
          tech: deep.technologies,
          contacts: deep.contacts,
          signals: deep.signals,
          competitivePressure: competitors.competitivePressureScore,
        });
      }

      // Store: firma lead'i olustur + uyumluluk alanlari (mevcut dashboard'da calissin).
      const lead = await store.upsertRaw(raw);
      lead.scanMode = "company";
      lead.enrichment = deep.enrichment;
      lead.intelligence = intel;
      lead.analysis = toCompatAnalysis(intel);
      lead.outreach = toCompatOutreach(raw.name, intel);
      lead.stage = "outreach_ready";
      await store.save(lead);

      item.leadId = lead.id;
      await setItem(status, item, "completed");
      done++;
      status.found = done;
      await writeScanStatus(status);
      console.log(`  ✓ ${item.name} → oncelik ${intel.scores.priorityScore} | guven ${intel.confidence}`);
    } catch (err) {
      item.message = (err as Error).message;
      await setItem(status, item, "error");
      console.warn(`  ! ${item.name}: ${item.message}`);
    }
  });

  status.running = false;
  status.phase = "done";
  status.finishedAt = new Date().toISOString();
  status.message = `${done}/${args.names.length} firma tamamlandi.`;
  await writeScanStatus(status);
  console.log(`\n[COMPANY-SCAN] Bitti. ${done}/${args.names.length} firma.`);
}

async function setItem(status: ScanStatus, item: CompanyScanItem, phase: CompanyScanItem["phase"]): Promise<void> {
  item.phase = phase;
  await writeScanStatus(status);
}

/** Intelligence -> mevcut Analysis (dashboard skor/liste/siralama uyumu). */
function toCompatAnalysis(intel: CompanyIntelligence): Analysis {
  const bp = intel.scores.buyingPotentialScore;
  const budgetLevel: Analysis["budgetLevel"] = bp >= 70 ? "yuksek" : bp >= 40 ? "orta" : "dusuk";
  const topOpp = intel.opportunities[0];
  return {
    biggestProblem: topOpp?.problem ?? intel.summary.whatTheyDo,
    timeWaster: topOpp?.name ?? "-",
    easiestAutomation: topOpp?.name ?? "-",
    recommendedServices: intel.recommendedServices.map((s) => s.service),
    bestRoiPitch: topOpp?.solution ?? intel.summary.digitalMaturity,
    leadScore: intel.scores.priorityScore,
    icpScore: intel.scores.buyingPotentialScore,
    urgencyScore: intel.scores.urgencyScore,
    budgetLevel,
    reasoning: intel.summary.whatTheyDo,
  };
}

/** Intelligence -> mevcut Outreach (wa.me/mailto gonderimi calissin). */
function toCompatOutreach(name: string, intel: CompanyIntelligence): Outreach {
  return {
    whatsapp: intel.outreach.whatsappMessage,
    email: {
      subject: `${name} için hızlı bir fikir`,
      body: intel.outreach.coldEmailShort,
    },
  };
}

async function parseArgs(argv: string[]): Promise<CompanyArgs> {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const names: string[] = [];
  const namesArg = get("--names");
  if (namesArg) names.push(...splitNames(namesArg));

  const csv = get("--csv");
  if (csv) names.push(...(await readCsvNames(csv)));

  const depthRaw = (get("--depth") ?? "standard").toLowerCase();
  const depth: ScanDepth = depthRaw === "quick" || depthRaw === "deep" ? depthRaw : "standard";
  const langRaw = (get("--lang") ?? "tr").toLowerCase();

  const max = Number(get("--max")) || 100;
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, max);

  const competitors = splitNames(get("--competitors") ?? "");
  const maxCompetitors = Number(get("--max-competitors")) || 4;
  // Rakip analizi: deep derinlikte otomatik; --with-competitors bayragi ya da elle rakip verilince de acilir.
  const withCompetitors =
    depth === "deep" || argv.includes("--with-competitors") || competitors.length > 0;

  return {
    names: unique,
    country: get("--country")?.trim() || undefined,
    city: get("--city")?.trim() || undefined,
    lang: langRaw === "en" ? "en" : "tr",
    max,
    depth,
    competitors,
    maxCompetitors,
    withCompetitors,
  };
}

function splitNames(v: string): string[] {
  // Virgül veya yeni satir ile ayrilmis firma adlari.
  return v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

async function readCsvNames(path: string): Promise<string[]> {
  try {
    const text = await readFile(path, "utf8");
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Basit CSV: ilk kolonu firma adi kabul et; baslik satirini ele.
    const out: string[] = [];
    for (const [i, line] of lines.entries()) {
      const first = line.split(",")[0]?.replace(/^["']|["']$/g, "").trim();
      if (!first) continue;
      if (i === 0 && /firma|company|name|isim|ad/i.test(first)) continue; // baslik
      out.push(first);
    }
    return out;
  } catch (err) {
    console.warn(`CSV okunamadi (${path}): ${(err as Error).message}`);
    return [];
  }
}

main().catch((err) => {
  console.error("\nHATA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
