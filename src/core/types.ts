// Vertex Lead Gen - cekirdek veri modelleri.
// Bir "Lead" pipeline boyunca asama asama zenginlesir:
// find -> enrich -> analyze -> outreach

import type { CompanyIntelligence } from "./intelligence.js";

/** Tarama modu: mevcut sektor-bazli veya yeni firma-bazli AI intelligence. */
export type ScanMode = "sector" | "company";

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

/** Google Maps / kaynak taramasindan gelen ham veri. */
export interface RawCompany {
  name: string;
  category?: string;
  subcategory?: string;
  description?: string;
  address?: string;
  city?: string;
  district?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
  // Firma-bazli modda cikarilan ek konum/kimlik verileri (opsiyonel).
  placeId?: string;
  lat?: number;
  lng?: number;
  hours?: string;
}

/** Website taramasindan cikarilan teknik/iletisim zenginlestirmesi. */
export interface Enrichment {
  emails: string[];
  socials: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    whatsapp?: string;
    youtube?: string;
    twitter?: string;
    tiktok?: string;
  };
  tech: {
    hasGoogleAnalytics: boolean;
    hasMetaPixel: boolean;
    hasGoogleTagManager: boolean;
    hasWhatsApp: boolean;
    hasOnlineOrdering: boolean;
    hasReservation: boolean;
    hasLiveChat: boolean;
    hasBlog: boolean; // icerik/blog var mi (pazarlama olgunlugu)
    ecommercePlatform?: string; // shopify, woocommerce, ...
    platform?: string; // CMS/site kurucu: wordpress, wix, squarespace, ...
    copyrightYear?: number; // footer telif yili -> guncellik/ihmal sinyali
  };
  websiteReachable: boolean;
  websiteTitle?: string;
  /** LLM'e ham baglam olarak verilecek kisaltilmis metin. */
  pageTextSnippet?: string;
  // Firma-bazli derin enrichment (opsiyonel; sektor akisi kullanmaz).
  generalEmail?: string;
  salesEmail?: string;
  supportEmail?: string;
  contactFormUrl?: string;
  /** Taranan sayfa URL'leri (about/contact/team/careers/services/products/blog). */
  pagesCrawled?: string[];
}

/** LLM analiz sonucu. */
export interface Analysis {
  biggestProblem: string;
  timeWaster: string;
  easiestAutomation: string;
  recommendedServices: string[]; // eslestirme motorundan cikan hizmetler
  bestRoiPitch: string;
  leadScore: number; // 0-100 satin alma potansiyeli
  icpScore: number; // 0-100 ideal musteri profiline uygunluk
  urgencyScore: number; // 0-100 aciliyet
  budgetLevel: "dusuk" | "orta" | "yuksek";
  reasoning: string;
}

/** Uretilen kisisellestirilmis mesaj taslaklari. */
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
  /** "sector" (varsayilan/mevcut) veya "company" (firma-bazli AI intelligence). */
  scanMode?: ScanMode;
  /** Bu lead'i ureten taramanin id'si (Tarama Gecmisi baglantisi). */
  scanId?: string;
  /** Firma-bazli modda uretilen tam AI Sales Intelligence blogu. */
  intelligence?: CompanyIntelligence;
  // Outreach/takip (dashboard'dan doldurulur)
  contactedAt?: string;
  contactChannel?: ContactChannel;
  followUpAt?: string;
  dealValue?: number; // elle girilen anlasma degeri (yoksa butceden tahmin)
}
