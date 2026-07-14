// Rakip analizi. Mevcut hicbir akisi BOZMAZ; firma-modu intelligence'a opsiyonel
// `competitors` blogu ekler. Ilke (README): AI UYDURMAZ — rakipler GERCEKTEN taranir
// (deepEnrichCompany), karsilastirma matrisi gercek site/DNS sinyallerinden uretilir.
// AI yalniz (a) aday rakip ismi onerir ve (b) matrise dayali nitel ozet/satis acisi yazar.

import { z } from "zod";
import { config } from "../../core/config.js";
import { llmJson } from "../../core/llm.js";
import { mapPool } from "../../core/pool.js";
import type { RawCompany } from "../../core/types.js";
import { findCompanyByName } from "../finder/byName.js";
import { deepEnrichCompany, type DeepEnrichResult } from "../enricher/deepEnrich.js";
import {
  buildCompetitorGaps,
  competitorCapabilities,
  computeCompetitivePressure,
  computeIntelScores,
  type CompanyIntelligence,
  type CompetitorAnalysis,
  type CompetitorGap,
  type CompetitorSnapshot,
  type TechStack,
} from "../../core/intelligence.js";

export interface CompetitorAnalysisOptions {
  raw: RawCompany;
  deep: DeepEnrichResult;
  intel: CompanyIntelligence;
  /** Kullanicinin elle verdigi rakip adlari (oncelikli). */
  userNames?: string[];
  /** Toplam rakip ust siniri. */
  max?: number;
  lang?: "tr" | "en";
}

interface CompetitorSeed {
  name: string;
  website?: string | null;
  source: "user" | "ai_suggested";
}

// ---------------------------------------------------------------------------
// 1) AI aday rakip onerisi (uydurma-onleyici; emin degilse bos)
// ---------------------------------------------------------------------------
const SuggestSchema = z.object({
  competitors: z
    .array(z.object({ name: z.string(), website: z.string().nullable().optional() }))
    .max(12),
});

export async function suggestCompetitors(
  raw: RawCompany,
  deep: DeepEnrichResult,
  lang: "tr" | "en",
  max: number,
): Promise<CompetitorSeed[]> {
  if (max <= 0) return [];
  const langRule = lang === "en" ? "Yaz: INGILIZCE." : "Yaz: TURKCE.";
  const system = [
    "Sen bir B2B pazar arastirma analistisin. Gorevin: verilen firmaya en yakin GERCEK rakipleri listelemek.",
    "",
    "KRITIK KURAL — UYDURMA YOK:",
    "- Yalniz gercekten var oldugunu bildigin, ayni sektor/pazardaki rakipleri ver.",
    "- Emin degilsen o firmayi EKLEME. Hicbir gercek rakip bilmiyorsan bos dizi dondur.",
    "- website'i biliyorsan ver (yalniz kok alan adi), bilmiyorsan null birak — TAHMIN ETME.",
    `- En fazla ${max} rakip.`,
    langRule,
    "",
    "Cikti SADECE JSON: {\"competitors\":[{\"name\":\"...\",\"website\":\"...|null\"}]}",
  ].join("\n");

  const user = [
    "=== FIRMA ===",
    `Isim: ${raw.name}`,
    `Sektor: ${raw.category ?? "-"}`,
    raw.website ? `Website: ${raw.website}` : "Website: yok",
    [raw.district, raw.city, raw.country].filter(Boolean).length
      ? `Konum: ${[raw.district, raw.city, raw.country].filter(Boolean).join(", ")}`
      : "",
    deep.enrichment.websiteTitle ? `Site basligi: ${deep.enrichment.websiteTitle}` : "",
    deep.pageTexts[0] ? `Ne yapiyor (ozet): ${deep.pageTexts[0].text.slice(0, 500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const out = await llmJson({ system, user, schema: SuggestSchema, maxTokens: 600 });
    return out.competitors
      .map((c) => ({ name: c.name.trim(), website: c.website ?? null, source: "ai_suggested" as const }))
      .filter((c) => c.name);
  } catch {
    return []; // oneri basarisizsa rakip analizi kullanici-verdikleriyle devam eder
  }
}

// ---------------------------------------------------------------------------
// 2) Tek rakibi bul + gercekten tara -> snapshot
// ---------------------------------------------------------------------------
async function scanCompetitor(seed: CompetitorSeed, raw: RawCompany): Promise<CompetitorSnapshot> {
  // Website'i coz: AI verdiyse onu kullan, yoksa isimle Maps'ten bul.
  let website = seed.website ?? null;
  let name = seed.name;
  if (!website) {
    const found = await findCompanyByName({ name: seed.name, country: raw.country, city: raw.city });
    website = found.website ?? null;
    name = found.name || seed.name;
  }

  const empty: CompetitorSnapshot = {
    name,
    website,
    source: seed.source,
    reachable: false,
    digitalMaturityScore: 0,
    techStack: emptyStack(),
    capabilities: competitorCapabilities(emptyStack(), undefined),
    socialPresence: [],
    note: website ? "Site taranamadi (erisilemedi)." : "Website bulunamadi.",
  };
  if (!website) return empty;

  const deep = await deepEnrichCompany({ name, website, country: raw.country, city: raw.city });
  const reachable = deep.enrichment.websiteReachable;
  const maturity = computeIntelScores({
    raw: { name, website },
    enrichment: deep.enrichment,
    tech: deep.technologies,
    contacts: deep.contacts,
    signals: deep.signals,
  }).digitalMaturityScore;

  return {
    name,
    website,
    source: seed.source,
    reachable,
    digitalMaturityScore: maturity,
    techStack: deep.technologies,
    capabilities: competitorCapabilities(deep.technologies, deep.enrichment),
    socialPresence: socialsOf(deep.enrichment),
    note: reachable ? undefined : "Site taranamadi (erisilemedi); yalniz DNS sinyalleri.",
  };
}

// ---------------------------------------------------------------------------
// 3) Ana akis: adlari topla -> tara -> matris -> nitel ozet
// ---------------------------------------------------------------------------
export async function runCompetitorAnalysis(opts: CompetitorAnalysisOptions): Promise<CompetitorAnalysis> {
  const { raw, deep, intel } = opts;
  const lang = opts.lang ?? "tr";
  const max = Math.max(1, opts.max ?? config.competitorMax);

  const leadHost = hostOf(raw.website);
  const leadKey = norm(raw.name);
  const seen = new Set<string>();
  const seeds: CompetitorSeed[] = [];

  const add = (s: CompetitorSeed) => {
    const key = norm(s.name);
    if (!key || key === leadKey) return; // lead'in kendisini rakip alma
    const host = hostOf(s.website);
    if (host && leadHost && host === leadHost) return; // ayni domain = lead
    if (seen.has(key) || (host && seen.has(host))) return;
    seen.add(key);
    if (host) seen.add(host);
    seeds.push(s);
  };

  // Once kullanici verdikleri (oncelikli), sonra AI onerileri.
  for (const n of opts.userNames ?? []) {
    if (seeds.length >= max) break;
    add({ name: n, source: "user" });
  }
  if (seeds.length < max) {
    const suggested = await suggestCompetitors(raw, deep, lang, max - seeds.length + 2);
    for (const s of suggested) {
      if (seeds.length >= max) break;
      add(s);
    }
  }

  // Rakipleri gercekten tara (ag I/O -> enrich eszamanlilik havuzu).
  const competitors: CompetitorSnapshot[] = new Array(seeds.length);
  await mapPool(seeds, config.enrichConcurrency, async (seed, i) => {
    try {
      competitors[i] = await scanCompetitor(seed, raw);
    } catch (err) {
      competitors[i] = {
        name: seed.name,
        website: seed.website ?? null,
        source: seed.source,
        reachable: false,
        digitalMaturityScore: 0,
        techStack: emptyStack(),
        capabilities: competitorCapabilities(emptyStack(), undefined),
        socialPresence: [],
        note: `Hata: ${(err as Error).message.slice(0, 80)}`,
      };
    }
  });

  // Deterministik matris + skorlar (lead'in kendi verisi deep'ten).
  const leadCaps = competitorCapabilities(deep.technologies, deep.enrichment);
  const leadMaturity = intel.scores.digitalMaturityScore;
  const gaps = buildCompetitorGaps(leadCaps, competitors.map((c) => c.capabilities));
  const reachableComps = competitors.filter((c) => c.reachable);
  const avgCompetitorMaturity = reachableComps.length
    ? Math.round(reachableComps.reduce((s, c) => s + c.digitalMaturityScore, 0) / reachableComps.length)
    : 0;
  const competitivePressureScore = computeCompetitivePressure(gaps, leadMaturity, avgCompetitorMaturity);
  const behindOn = gaps.filter((g) => g.verdict === "behind").map((g) => g.capability);
  const aheadOn = gaps.filter((g) => g.verdict === "ahead").map((g) => g.capability);

  // AI nitel katman — SADECE matristen konusur (uydurma yok).
  const narrative = await narrate(raw, competitors, gaps, {
    leadMaturity,
    avgCompetitorMaturity,
    competitivePressureScore,
    behindOn,
    aheadOn,
    lang,
  });

  return {
    generatedAt: new Date().toISOString(),
    competitors,
    gaps,
    leadDigitalMaturity: leadMaturity,
    avgCompetitorMaturity,
    competitivePressureScore,
    behindOn,
    aheadOn,
    competitiveSummary: narrative.competitiveSummary,
    salesAngle: narrative.salesAngle,
  };
}

// ---------------------------------------------------------------------------
// AI nitel ozet (matris tabanli; uydurma yok)
// ---------------------------------------------------------------------------
const NarrateSchema = z.object({ competitiveSummary: z.string(), salesAngle: z.string() });

async function narrate(
  raw: RawCompany,
  competitors: CompetitorSnapshot[],
  gaps: CompetitorGap[],
  ctx: {
    leadMaturity: number;
    avgCompetitorMaturity: number;
    competitivePressureScore: number;
    behindOn: string[];
    aheadOn: string[];
    lang: "tr" | "en";
  },
): Promise<z.infer<typeof NarrateSchema>> {
  const langRule = ctx.lang === "en" ? "Yaz: INGILIZCE." : "Yaz: TURKCE.";
  const system = [
    "Sen Vertex adli AI otomasyon ajansinin rakip-analizi danismanisin.",
    "SADECE sana verilen karsilastirma matrisinden ve skorlardan konus — hicbir sey uydurma.",
    "competitiveSummary: lead'in rakiplerine gore dijital konumunu 2-4 cumlede ozetle (nerede geride/onde).",
    "salesAngle: bu farklardan yararlanan, Vertex hizmetlerine baglayan somut bir satis acisi (2-4 cumle).",
    "Rakip yoksa/veri zayifsa bunu durustce belirt.",
    langRule,
    "",
    "Cikti SADECE JSON: {\"competitiveSummary\":\"...\",\"salesAngle\":\"...\"}",
  ].join("\n");

  const matrix = gaps
    .map((g) => `- ${g.capability}: lead ${g.leadHas ? "VAR" : "YOK"} | rakipler ${g.competitorsWithIt}/${g.totalCompetitors} (${g.verdict})`)
    .join("\n");
  const compList = competitors
    .map((c) => `- ${c.name}${c.reachable ? "" : " (erisilemedi)"} — dijital olgunluk ${c.digitalMaturityScore}`)
    .join("\n");

  const user = [
    `=== LEAD: ${raw.name} ===`,
    `Dijital olgunluk: ${ctx.leadMaturity} | Rakip ort.: ${ctx.avgCompetitorMaturity} | Rakip baskisi: ${ctx.competitivePressureScore}`,
    ctx.behindOn.length ? `Geride: ${ctx.behindOn.join(", ")}` : "Geride kaldigi yetenek yok.",
    ctx.aheadOn.length ? `Onde: ${ctx.aheadOn.join(", ")}` : "One ciktigi yetenek yok.",
    "",
    "=== RAKIPLER ===",
    compList || "(rakip bulunamadi)",
    "",
    "=== YETENEK MATRISI ===",
    matrix,
  ].join("\n");

  try {
    return await llmJson({ system, user, schema: NarrateSchema, maxTokens: 700 });
  } catch {
    // LLM basarisizsa deterministik yedek metin (uydurma degil; matristen tureti).
    const behind = ctx.behindOn.length ? `Rakiplerinde olup sizde olmayan: ${ctx.behindOn.join(", ")}.` : "Belirgin bir dijital eksik tespit edilmedi.";
    return {
      competitiveSummary: `${raw.name} dijital olgunlukta ${ctx.leadMaturity}, rakip ortalamasi ${ctx.avgCompetitorMaturity}. ${behind}`,
      salesAngle: ctx.behindOn.length
        ? `Rakip baskisi ${ctx.competitivePressureScore}. ${ctx.behindOn.join(", ")} basliklarindaki acik, Vertex otomasyon/CRM hizmetleriyle hizla kapatilabilir.`
        : "Guclu yanlari korurken operasyon verimliligi icin otomasyon firsatlari degerlendirilebilir.",
    };
  }
}

// ---------------------------------------------------------------------------
// Yardimcilar
// ---------------------------------------------------------------------------
function emptyStack(): TechStack {
  return {
    cms: [], frontend: [], analytics: [], crmMarketing: [], infrastructure: [], ecommerce: [],
    emailDns: { mxRecords: [], mailProvider: null, spf: null, dkim: null, dmarc: null, ssl: null },
  };
}

function socialsOf(e: DeepEnrichResult["enrichment"]): string[] {
  return Object.entries(e.socials).filter(([, v]) => v).map(([k]) => k);
}

function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function norm(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/gi, " ").trim();
}
