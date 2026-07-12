// Firma-bazli AI Sales Intelligence analizi.
// AI yalniz NITEL katmani uretir (ozet/ihtiyac/firsat/hizmet/outreach); SAYISAL skorlar
// koddan deterministik hesaplanir (computeIntelScores). AI UYDURMAZ: veri yoksa
// "insufficient_data" / bos dizi / null doner.

import { llmJson } from "../../core/llm.js";
import type { RawCompany } from "../../core/types.js";
import type { DeepEnrichResult } from "../enricher/deepEnrich.js";
import {
  CompanyIntelSchema,
  INTELLIGENCE_SERVICES,
  computeIntelScores,
  type CompanyIntelligence,
  type ScanDepth,
} from "../../core/intelligence.js";

export interface IntelOptions {
  depth?: ScanDepth;
  language?: "tr" | "en";
}

export async function analyzeIntelligence(
  raw: RawCompany,
  deep: DeepEnrichResult,
  opts: IntelOptions = {},
): Promise<CompanyIntelligence> {
  const depth = opts.depth ?? "standard";
  const lang = opts.language ?? "tr";

  const system = buildSystem(lang);
  const user = buildContext(raw, deep);

  const ai = await llmJson({
    system,
    user,
    schema: CompanyIntelSchema,
    maxTokens: 2600,
  });

  const scores = computeIntelScores({
    raw,
    enrichment: deep.enrichment,
    tech: deep.technologies,
    contacts: deep.contacts,
    signals: deep.signals,
  });

  return {
    depth,
    generatedAt: new Date().toISOString(),
    summary: {
      whatTheyDo: ai.companySummary,
      industry: ai.industry,
      targetCustomers: ai.targetCustomers,
      estimatedSize: ai.estimatedSize,
      digitalMaturity: ai.digitalMaturity,
    },
    potentialNeeds: ai.potentialNeeds,
    opportunities: ai.automationOpportunities,
    recommendedServices: ai.recommendedServices,
    outreach: ai.outreach,
    contacts: deep.contacts,
    technologies: deep.technologies,
    signals: deep.signals,
    scores,
    sources: deep.sources,
    confidence: ai.confidence,
  };
}

function buildSystem(lang: "tr" | "en"): string {
  const langRule =
    lang === "en"
      ? "Tum metin ciktilarini INGILIZCE yaz."
      : "Tum metin ciktilarini TURKCE yaz.";
  return [
    "Sen Vertex adli bir AI otomasyon ajansinin Kidemli B2B Sales Intelligence analistisin.",
    "Gorevin: verilen firma verisinden satis-odakli, uygulanabilir bir istihbarat raporu uretmek.",
    "",
    "KRITIK KURAL — UYDURMA YOK:",
    "- Yalniz sana verilen veriden cikarim yap. Emin olmadigin bir sey icin uydurma.",
    "- Bir bilgi verilmemisse: metin alaninda 'insufficient_data', dizide bos [], estimatedSize'da null kullan.",
    "- confidence (0-100): eldeki veri ne kadar zenginse o kadar yuksek. Veri azsa dusuk ver.",
    "",
    "Vertex'in sunabilecegi hizmetler (recommendedServices.service SADECE bu listeden secilecek):",
    INTELLIGENCE_SERVICES.map((s) => `- ${s}`).join("\n"),
    "",
    "automationOpportunities: firmaya OZEL 3-7 otomasyon firsati. Her biri: name, problem, solution,",
    "approach (kullanilacak AI/otomasyon yaklasimi), estimatedImpact, difficulty (dusuk|orta|yuksek),",
    "priority (dusuk|orta|yuksek).",
    "recommendedServices: her biri {service, fitScore 0-100} — firmaya uygunluk skoru.",
    "outreach: coldEmailShort (kisa/direkt), coldEmailConsultative (danismanlik odakli),",
    "coldEmailProblemSolution (problem/cozum), linkedinMessage (kisa), whatsappMessage (sicak/kisa),",
    "callScript (kisa arama metni). Her e-posta: firma adi gecsin, sektore ozel problem, net cozum,",
    "acik CTA, SPAM gibi gorunmesin, dogal/insan gibi.",
    langRule,
    "",
    "Cikti SADECE gecerli JSON: {companySummary, industry, targetCustomers[], estimatedSize|null,",
    "digitalMaturity, potentialNeeds[], automationOpportunities[], recommendedServices[], outreach{}, confidence}.",
  ].join("\n");
}

function buildContext(raw: RawCompany, deep: DeepEnrichResult): string {
  const e = deep.enrichment;
  const t = deep.technologies;
  const lines: string[] = [
    "=== FIRMA ===",
    `Isim: ${raw.name}`,
    raw.category ? `Kategori: ${raw.category}` : "",
    raw.website ? `Website: ${raw.website}` : "Website: YOK",
    [raw.city, raw.district, raw.country].filter(Boolean).length
      ? `Konum: ${[raw.district, raw.city, raw.country].filter(Boolean).join(", ")}`
      : "",
    raw.phone ? `Telefon: ${raw.phone}` : "",
    raw.rating != null ? `Google: ${raw.rating} yildiz (${raw.reviewCount ?? 0} yorum)` : "",
  ];

  if (e.websiteReachable) {
    lines.push(
      "",
      "=== WEBSITE ===",
      `Baslik: ${e.websiteTitle ?? "-"}`,
      `Taranan sayfalar: ${e.pagesCrawled?.length ?? 1}`,
      `E-postalar: ${e.emails.length ? e.emails.join(", ") : "yok"}`,
      `Satis e-postasi: ${e.salesEmail ?? "yok"} | Destek: ${e.supportEmail ?? "yok"}`,
      `Sosyal: ${socialsLine(e.socials)}`,
      "",
      "=== TEKNOLOJI STACK (tespit edilen) ===",
      `CMS: ${j(t.cms)} | Frontend: ${j(t.frontend)}`,
      `Analytics: ${j(t.analytics)} | CRM/Pazarlama: ${j(t.crmMarketing)}`,
      `Altyapi: ${j(t.infrastructure)} | E-ticaret: ${j(t.ecommerce)}`,
      `Mail: ${t.emailDns.mailProvider ?? "?"} | SPF:${b(t.emailDns.spf)} DMARC:${b(t.emailDns.dmarc)} SSL:${b(t.emailDns.ssl)}`,
    );
  } else if (raw.website) {
    lines.push("", "Website verilmis ama erisilemedi (zayif dijital altyapi sinyali).");
  }

  if (deep.contacts.length) {
    lines.push("", "=== KARAR VERICILER (site-turevli) ===");
    for (const c of deep.contacts.slice(0, 8)) {
      lines.push(`- ${c.name}${c.title ? ` (${c.title})` : ""} ${c.linkedin ?? ""}`.trim());
    }
  }

  if (deep.signals.length) {
    lines.push("", "=== GUNCEL SINYALLER (site-turevli) ===");
    for (const s of deep.signals) lines.push(`- ${s.title}: ${s.summary}`);
  }

  if (deep.pageTexts.length) {
    lines.push("", "=== SAYFA METINLERI (ozet) ===");
    for (const p of deep.pageTexts.slice(0, 6)) {
      lines.push(`[${p.label}] ${p.text.slice(0, 800)}`);
    }
  }

  return lines.filter(Boolean).join("\n");
}

function socialsLine(s: RawSocials): string {
  const parts = Object.entries(s).filter(([, v]) => v).map(([k]) => k);
  return parts.length ? parts.join(", ") : "yok";
}
type RawSocials = Record<string, string | undefined>;

function j(arr: string[]): string {
  return arr.length ? arr.join(", ") : "tespit edilemedi";
}
function b(v: boolean | null): string {
  return v == null ? "?" : v ? "var" : "yok";
}
