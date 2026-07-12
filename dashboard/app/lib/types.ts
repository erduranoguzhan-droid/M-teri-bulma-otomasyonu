// vertex-leadgen/src/core/types.ts'in aynasi (dashboard ayri bir Next projesi).
// Kaynak degisirse burayi da guncelle.

export type CrmStatus =
  | "yeni"
  | "iletisim_kuruldu"
  | "yanit_bekleniyor"
  | "toplanti_planlandi"
  | "teklif_gonderildi"
  | "muzakere"
  | "kazanildi"
  | "kaybedildi"
  | "takip";

export type PipelineStage = "found" | "enriched" | "analyzed" | "outreach_ready";

export interface RawCompany {
  name: string;
  category?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
}

export interface Enrichment {
  emails: string[];
  socials: {
    instagram?: string; facebook?: string; linkedin?: string; whatsapp?: string;
    youtube?: string; twitter?: string; tiktok?: string;
  };
  tech: {
    hasGoogleAnalytics: boolean;
    hasMetaPixel: boolean;
    hasGoogleTagManager: boolean;
    hasWhatsApp: boolean;
    hasOnlineOrdering: boolean;
    hasReservation: boolean;
    hasLiveChat: boolean;
    hasBlog: boolean;
    ecommercePlatform?: string;
    platform?: string;
    copyrightYear?: number;
  };
  websiteReachable: boolean;
  websiteTitle?: string;
  pageTextSnippet?: string;
  // Firma-bazlı derin enrichment (opsiyonel).
  generalEmail?: string;
  salesEmail?: string;
  supportEmail?: string;
  contactFormUrl?: string;
  pagesCrawled?: string[];
}

export interface Analysis {
  biggestProblem: string;
  timeWaster: string;
  easiestAutomation: string;
  recommendedServices: string[];
  bestRoiPitch: string;
  leadScore: number;
  icpScore: number;
  urgencyScore: number;
  budgetLevel: "dusuk" | "orta" | "yuksek";
  reasoning: string;
}

export interface Outreach {
  whatsapp: string;
  email: { subject: string; body: string };
}

export type ContactChannel = "whatsapp" | "email";

export type ScanMode = "sector" | "company";
export type ScanDepth = "quick" | "standard" | "deep";

// --- Firma-bazlı AI Sales Intelligence (src/core/intelligence.ts aynası) ---
export interface TechStack {
  cms: string[];
  frontend: string[];
  analytics: string[];
  crmMarketing: string[];
  infrastructure: string[];
  ecommerce: string[];
  emailDns: {
    mxRecords: string[];
    mailProvider: string | null;
    spf: boolean | null;
    dkim: boolean | null;
    dmarc: boolean | null;
    ssl: boolean | null;
  };
}

export interface DecisionMaker {
  name: string;
  title: string | null;
  linkedin: string | null;
  twitter: string | null;
  email: string | null;
  sourceUrl: string | null;
  confidence: number;
}

export interface NewsSignal {
  title: string;
  date: string | null;
  source: string | null;
  summary: string;
  salesMeaning: string;
}

export interface AutomationOpportunity {
  name: string;
  problem: string;
  solution: string;
  approach: string;
  estimatedImpact: string;
  difficulty: "dusuk" | "orta" | "yuksek";
  priority: "dusuk" | "orta" | "yuksek";
}

export interface ServiceFit {
  service: string;
  fitScore: number;
}

export interface OutreachVariants {
  coldEmailShort: string;
  coldEmailConsultative: string;
  coldEmailProblemSolution: string;
  linkedinMessage: string;
  whatsappMessage: string;
  callScript: string;
}

export interface IntelScores {
  coldOutreachScore: number;
  buyingPotentialScore: number;
  aiFitScore: number;
  digitalMaturityScore: number;
  urgencyScore: number;
  priorityScore: number;
}

export interface CompanyIntelligence {
  depth: ScanDepth;
  generatedAt: string;
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
  contacts: DecisionMaker[];
  technologies: TechStack;
  signals: NewsSignal[];
  scores: IntelScores;
  sources: string[];
  confidence: number;
}

export interface Lead {
  id: string;
  stage: PipelineStage;
  crmStatus: CrmStatus;
  createdAt: string;
  updatedAt: string;
  raw: RawCompany;
  enrichment?: Enrichment;
  analysis?: Analysis;
  outreach?: Outreach;
  scanMode?: ScanMode;
  intelligence?: CompanyIntelligence;
  contactedAt?: string;
  contactChannel?: ContactChannel;
  followUpAt?: string;
  dealValue?: number; // elle girilen anlasma degeri (yoksa butceden tahmin)
}

export const OPP_PRIORITY_LABEL: Record<AutomationOpportunity["priority"], string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek",
};

export const INTEL_SCORE_META: { key: keyof IntelScores; label: string }[] = [
  { key: "priorityScore", label: "Öncelik" },
  { key: "buyingPotentialScore", label: "Satın Alma" },
  { key: "aiFitScore", label: "AI Uygunluk" },
  { key: "coldOutreachScore", label: "Cold Outreach" },
  { key: "digitalMaturityScore", label: "Dijital Olgunluk" },
  { key: "urgencyScore", label: "Aciliyet" },
];

export const FOLLOWUP_DAYS = 3;

// CRM statuleri: sira + Turkce etiket + renk.
export const CRM_STATUSES: { value: CrmStatus; label: string; color: string }[] = [
  { value: "yeni", label: "Yeni", color: "#6366f1" },
  { value: "iletisim_kuruldu", label: "İletişim Kuruldu", color: "#0891b2" },
  { value: "yanit_bekleniyor", label: "Yanıt Bekleniyor", color: "#ca8a04" },
  { value: "toplanti_planlandi", label: "Toplantı Planlandı", color: "#7c3aed" },
  { value: "teklif_gonderildi", label: "Teklif Gönderildi", color: "#2563eb" },
  { value: "muzakere", label: "Müzakere", color: "#ea580c" },
  { value: "kazanildi", label: "Kazanıldı", color: "#16a34a" },
  { value: "kaybedildi", label: "Kaybedildi", color: "#dc2626" },
  { value: "takip", label: "Takip", color: "#64748b" },
];

export const BUDGET_LABEL: Record<Analysis["budgetLevel"], string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek",
};
