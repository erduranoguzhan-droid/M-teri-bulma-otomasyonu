// Firma-bazli AI Sales Intelligence katmani.
// Mevcut sektor-bazli akisi BOZMAZ; Lead'e opsiyonel `intelligence` blogu olarak eklenir.
// Ilke: AI hicbir veriyi UYDURMAZ. Veri yoksa null / "unknown" / "insufficient_data".

import { z } from "zod";
import type { Enrichment, RawCompany } from "./types.js";

// ---------------------------------------------------------------------------
// Tarama derinligi
// ---------------------------------------------------------------------------
export type ScanDepth = "quick" | "standard" | "deep";

// ---------------------------------------------------------------------------
// Firma-bazli mod icin Vertex hizmet katalogu (kullanicinin verdigi liste).
// recommendedServices SADECE bu listeden secilir (halusinasyon engeli).
// ---------------------------------------------------------------------------
export const INTELLIGENCE_SERVICES = [
  "Musteri Destek Agent",
  "Satis Outreach Agent",
  "Icerik Uretim Agent",
  "Operasyon & Muhasebe Agent",
  "Workflow Otomasyon Agent",
  "Ozel AI Gelistirme",
  "AI Adaptasyon Yol Haritasi",
  "Otomasyon Stratejisi",
  "Cloud & Veri Mimarisi",
  "Strateji Calistayi",
  "Mentorluk Retainer",
] as const;

// ---------------------------------------------------------------------------
// Site-turevli (v1) toplanan yapisal veriler
// ---------------------------------------------------------------------------

/** Teknoloji stack tespiti — her alan tespit edilen isim dizisi (bos = tespit edilemedi). */
export interface TechStack {
  cms: string[]; // WordPress, Webflow, Shopify, Wix, Squarespace, ...
  frontend: string[]; // React, Next.js, Vue, Nuxt, Angular
  analytics: string[]; // GA, GTM, Meta Pixel, TikTok Pixel, LinkedIn Insight, Hotjar, Clarity
  crmMarketing: string[]; // HubSpot, Salesforce, Intercom, Zendesk, Drift, Mailchimp, Klaviyo, ActiveCampaign
  infrastructure: string[]; // Cloudflare, AWS, Vercel, Netlify, Firebase, Supabase
  ecommerce: string[]; // Shopify, WooCommerce, Magento, BigCommerce
  emailDns: EmailDns;
}

/** E-posta/DNS altyapisi (Node yerlesik dns/tls ile; harici paket yok). */
export interface EmailDns {
  mxRecords: string[];
  mailProvider: string | null; // Google Workspace, Microsoft 365, Yandex, ...
  spf: boolean | null;
  dkim: boolean | null; // TXT'den cikarilamayabilir -> null = insufficient_data
  dmarc: boolean | null;
  ssl: boolean | null;
}

/** Karar verici (v1: yalniz site-turevli ve guvenli kaynaklardan; uydurma yok). */
export interface DecisionMaker {
  name: string;
  title: string | null;
  linkedin: string | null;
  twitter: string | null;
  email: string | null;
  sourceUrl: string | null;
  confidence: number; // 0-100
}

/** Guncel sinyal (v1: site-turevli — kariyer/blog/haber sayfalarindan). */
export interface NewsSignal {
  title: string;
  date: string | null;
  source: string | null;
  summary: string;
  salesMeaning: string; // satis acisindan anlami
}

// ---------------------------------------------------------------------------
// Skorlar (deterministik, sinyallerden hesaplanir — LLM tahmini degil)
// ---------------------------------------------------------------------------
export interface IntelScores {
  coldOutreachScore: number;
  buyingPotentialScore: number;
  aiFitScore: number;
  digitalMaturityScore: number;
  urgencyScore: number;
  priorityScore: number;
}

// ---------------------------------------------------------------------------
// AI'nin urettigi NITEL katman (Zod ile dogrulanir)
// ---------------------------------------------------------------------------
export const OPP_DIFFICULTY = ["dusuk", "orta", "yuksek"] as const;
export const OPP_PRIORITY = ["dusuk", "orta", "yuksek"] as const;

/** LLM ciktisini 3 kovaya normalize eder (medium->orta, high->yuksek, aksan/case). */
function normLevel(v: unknown): string {
  const s = String(v ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ğ/g, "g")
    .trim();
  if (/dusuk|low|kolay|easy|basit|minor/.test(s)) return "dusuk";
  if (/yuksek|high|zor|hard|complex|kompleks|major|kritik|critical/.test(s)) return "yuksek";
  return "orta"; // orta/medium/moderate/bilinmeyen -> guvenli orta
}
const LevelSchema = z.preprocess(normLevel, z.enum(OPP_DIFFICULTY));

export const AutomationOpportunitySchema = z.object({
  name: z.string(),
  problem: z.string(),
  solution: z.string(),
  approach: z.string(), // kullanilacak AI/otomasyon yaklasimi
  estimatedImpact: z.string(),
  difficulty: LevelSchema,
  priority: LevelSchema,
});

export const ServiceFitSchema = z.object({
  service: z.string(),
  fitScore: z.coerce.number().min(0).max(100).catch(50),
});

export const OutreachVariantsSchema = z.object({
  coldEmailShort: z.string(),
  coldEmailConsultative: z.string(),
  coldEmailProblemSolution: z.string(),
  linkedinMessage: z.string(),
  whatsappMessage: z.string(),
  callScript: z.string(),
});

/** AI'nin dondurdugu yapi. Veri yetersizse metin alanlari "insufficient_data" olabilir. */
export const CompanyIntelSchema = z.object({
  companySummary: z.string(),
  industry: z.string(),
  targetCustomers: z.array(z.string()),
  estimatedSize: z.string().nullable(),
  digitalMaturity: z.string(),
  potentialNeeds: z.array(z.string()),
  automationOpportunities: z.array(AutomationOpportunitySchema).min(1).max(7),
  recommendedServices: z.array(ServiceFitSchema),
  outreach: OutreachVariantsSchema,
  confidence: z.coerce.number().min(0).max(100).catch(50),
});

export type CompanyIntel = z.infer<typeof CompanyIntelSchema>;
export type AutomationOpportunity = z.infer<typeof AutomationOpportunitySchema>;
export type ServiceFit = z.infer<typeof ServiceFitSchema>;
export type OutreachVariants = z.infer<typeof OutreachVariantsSchema>;

// ---------------------------------------------------------------------------
// Lead'e eklenen tam intelligence blogu (AI nitel + site-turevli + skorlar)
// ---------------------------------------------------------------------------
export interface CompanyIntelligence {
  depth: ScanDepth;
  generatedAt: string;
  // AI nitel katman
  summary: {
    whatTheyDo: string;
    industry: string;
    targetCustomers: string[];
    estimatedSize: string | null;
    digitalMaturity: string;
  };
  potentialNeeds: string[];
  opportunities: AutomationOpportunity[];
  recommendedServices: ServiceFit[];
  outreach: OutreachVariants;
  // Site-turevli yapisal veri
  contacts: DecisionMaker[];
  technologies: TechStack;
  signals: NewsSignal[];
  // Deterministik skorlar
  scores: IntelScores;
  // Guven + kaynak izlenebilirligi
  sources: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Deterministik skorlama — sinyallerden hesaplanir (mevcut scoring.ts felsefesi).
// Bulunamayan sinyal skoru dusurur ama uydurma yapmaz.
// ---------------------------------------------------------------------------
export interface IntelScoreInput {
  raw: RawCompany;
  enrichment: Enrichment | undefined;
  tech: TechStack;
  contacts: DecisionMaker[];
  signals: NewsSignal[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Teknoloji zenginligi 0-100 (kac alanda anlamli stack tespit edildi). */
function techRichness(t: TechStack): number {
  let s = 0;
  if (t.cms.length) s += 15;
  if (t.frontend.length) s += 20;
  if (t.analytics.length) s += 20;
  if (t.crmMarketing.length) s += 25;
  if (t.infrastructure.length) s += 10;
  if (t.ecommerce.length) s += 10;
  return clamp(s);
}

export function computeIntelScores(input: IntelScoreInput): IntelScores {
  const { raw, enrichment: e, tech, contacts, signals } = input;
  const reachable = !!e?.websiteReachable;
  const hasSite = !!raw.website;
  const hasEmail = (e?.emails?.length ?? 0) > 0;
  const hasPhone = !!raw.phone;
  const hasLinkedIn = !!e?.socials?.linkedin;
  const hasCrm = tech.crmMarketing.length > 0;
  const hasAnalytics = tech.analytics.length > 0;
  const hasDecisionMaker = contacts.length > 0;
  const hiring = signals.some((sig) => /ise alim|hiring|kariyer|acik pozisyon|open position/i.test(`${sig.title} ${sig.summary}`));
  const growth = signals.some((sig) => /buyume|yatirim|fon|funding|growth|yeni ofis|expansion|lansman|launch/i.test(`${sig.title} ${sig.summary}`));

  // Dijital olgunluk: site + teknoloji zenginligi + analytics/CRM.
  const digitalMaturity = clamp(
    (hasSite ? 20 : 0) +
      (reachable ? 10 : 0) +
      0.5 * techRichness(tech) +
      (hasCrm ? 10 : 0) +
      (hasAnalytics ? 5 : 0),
  );

  // AI uygunlugu: dijital ihtiyac (olgunluk dusukse otomasyon firsati yuksek)
  // + erisilebilirlik (net fayda uretilebilir) + buyume sinyali.
  const digitalNeed = 100 - digitalMaturity; // olgunluk dusuk = ihtiyac yuksek
  const aiFit = clamp(0.5 * digitalNeed + (reachable ? 20 : 10) + (hiring ? 15 : 0) + (growth ? 15 : 0));

  // Satin alma potansiyeli: erisilebilirlik + karar verici + buyume + kurumsallik.
  const buyingPotential = clamp(
    (hasEmail ? 20 : 0) +
      (hasPhone ? 15 : 0) +
      (hasDecisionMaker ? 25 : 0) +
      (hasLinkedIn ? 10 : 0) +
      (growth ? 15 : 0) +
      (reachable ? 15 : 0),
  );

  // Cold outreach: ulasilabilir kanal + karar verici + LinkedIn.
  const coldOutreach = clamp(
    (hasEmail ? 35 : 0) +
      (hasDecisionMaker ? 25 : 0) +
      (hasLinkedIn ? 20 : 0) +
      (hasPhone ? 10 : 0) +
      (e?.contactFormUrl ? 10 : 0),
  );

  // Aciliyet: dijital bosluklar (firsat) + buyume/ise alim (simdi dokun).
  const staleSite = e?.tech?.copyrightYear != null && e.tech.copyrightYear <= new Date().getFullYear() - 2;
  const urgency = clamp(
    0.4 * digitalNeed +
      (!hasCrm ? 15 : 0) +
      (!hasAnalytics ? 10 : 0) +
      (hiring ? 15 : 0) +
      (growth ? 15 : 0) +
      (staleSite ? 10 : 0),
  );

  // Oncelik: aciliyet + potansiyel + AI uygunlugu agirlikli.
  const priority = clamp(0.4 * urgency + 0.35 * buyingPotential + 0.25 * aiFit);

  return {
    coldOutreachScore: coldOutreach,
    buyingPotentialScore: buyingPotential,
    aiFitScore: aiFit,
    digitalMaturityScore: digitalMaturity,
    urgencyScore: urgency,
    priorityScore: priority,
  };
}
