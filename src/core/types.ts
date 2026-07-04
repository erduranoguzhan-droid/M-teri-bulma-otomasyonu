// Vertex Lead Gen - cekirdek veri modelleri.
// Bir "Lead" pipeline boyunca asama asama zenginlesir:
// find -> enrich -> analyze -> outreach

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
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
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
  // Outreach/takip (dashboard'dan doldurulur)
  contactedAt?: string;
  contactChannel?: ContactChannel;
  followUpAt?: string;
  dealValue?: number; // elle girilen anlasma degeri (yoksa butceden tahmin)
}
