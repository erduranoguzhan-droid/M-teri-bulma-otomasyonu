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
  contactedAt?: string;
  contactChannel?: ContactChannel;
  followUpAt?: string;
  dealValue?: number; // elle girilen anlasma degeri (yoksa butceden tahmin)
}

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
