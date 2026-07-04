import type { Analysis, Enrichment, RawCompany } from "./types.js";
import { sectorFor } from "./services.js";

/**
 * Deterministik lead skorlama. LLM'in tutarsiz 0-100 tahminleri yerine,
 * objektif sinyallerden hesaplanir -> ayni girdi ayni skor, ayrisan dagilim.
 *
 * - urgencyScore: BOSLUKLAR (eksik dijital altyapi) ne kadar cok -> o kadar yuksek.
 *   v2: agirliklar SEKTORE gore degisir (ilac fabrikasi icin "online siparis yok"
 *   firsat degil; restoran icin buyuk firsat). Alakasiz sinyaller sifirlanir.
 * - icpScore: isletme ne kadar erisilebilir/kurumsal/koklu -> o kadar yuksek (sektor-notr).
 * - leadScore: oncelik = aciliyet + ICP + butce agirlikli birlesim.
 */

export interface ScoreResult {
  leadScore: number;
  icpScore: number;
  urgencyScore: number;
}

const BUDGET_FACTOR: Record<Analysis["budgetLevel"], number> = {
  dusuk: 30,
  orta: 65,
  yuksek: 100,
};

// Aciliyet sinyal agirliklari (sektore gore). 0 = o sektor icin alakasiz.
export interface UrgencyWeights {
  noWebsite: number;
  unreachable: number;
  noWhatsApp: number;
  noOnlineOrdering: number;
  noReservation: number;
  noAnalytics: number;
  noMetaPixel: number;
  noInstagram: number;
  noLinkedIn: number; // B2B kanali eksik
  noEmail: number;
  staleSite: number; // telif yili eski -> ihmal edilmis site
  lowRating: number; // < 4.0
  midRating: number; // < 4.5
  fewReviews: number; // < 50
}

// restoran-kafe = temel profil (onceki davranis).
const BASE: UrgencyWeights = {
  noWebsite: 35, unreachable: 32, noWhatsApp: 10, noOnlineOrdering: 12, noReservation: 6,
  noAnalytics: 6, noMetaPixel: 8, noInstagram: 8, noLinkedIn: 0, noEmail: 5, staleSite: 8,
  lowRating: 10, midRating: 5, fewReviews: 6,
};

export const SECTOR_URGENCY: Record<string, UrgencyWeights> = {
  "restoran-kafe": BASE,
  "saglik-klinik": {
    ...BASE, noOnlineOrdering: 0, noReservation: 14, noWhatsApp: 12, noInstagram: 10,
    noMetaPixel: 8, lowRating: 12, fewReviews: 8,
  },
  "eticaret-perakende": {
    ...BASE, noOnlineOrdering: 15, noReservation: 0, noWhatsApp: 10, noAnalytics: 10,
    noMetaPixel: 12, noInstagram: 8, noEmail: 8,
  },
  "uretim-sanayi": {
    // B2B: tuketici kanallari (siparis/rezervasyon/whatsapp/instagram) alakasiz;
    // LinkedIn eksikligi ise B2B kanal bosluğu = firsat.
    ...BASE, noOnlineOrdering: 0, noReservation: 0, noWhatsApp: 0, noInstagram: 0,
    noLinkedIn: 10, noMetaPixel: 4, noAnalytics: 8, noEmail: 15, lowRating: 5, midRating: 2, fewReviews: 3,
  },
  genel: { ...BASE, noOnlineOrdering: 6, noReservation: 3, noInstagram: 6 },
};

export function urgencyWeightsFor(sector: string): UrgencyWeights {
  return SECTOR_URGENCY[sector] ?? BASE;
}

export function computeScores(
  raw: RawCompany,
  e: Enrichment | undefined,
  budgetLevel: Analysis["budgetLevel"],
  sector?: string,
): ScoreResult {
  const w = urgencyWeightsFor(sector ?? sectorFor(raw));
  const urgencyScore = clamp(urgency(raw, e, w));
  const icpScore = clamp(icp(raw, e));
  const leadScore = clamp(0.45 * urgencyScore + 0.35 * icpScore + 0.2 * BUDGET_FACTOR[budgetLevel]);
  return { leadScore, icpScore, urgencyScore };
}

/** Eksiklikler = firsat. Sektore gore agirlikli. */
function urgency(raw: RawCompany, e: Enrichment | undefined, w: UrgencyWeights): number {
  let s = 0;
  const t = e?.tech;

  // En buyuk sinyal: dijital varlik yok / bozuk.
  if (!raw.website) s += w.noWebsite;
  else if (!e?.websiteReachable) s += w.unreachable;

  if (!t?.hasWhatsApp) s += w.noWhatsApp;
  if (!t?.hasOnlineOrdering) s += w.noOnlineOrdering;
  if (!t?.hasReservation) s += w.noReservation;
  if (!t?.hasGoogleAnalytics) s += w.noAnalytics;
  if (!t?.hasMetaPixel) s += w.noMetaPixel;
  if (!e?.socials.instagram) s += w.noInstagram;
  if (!e?.socials.linkedin) s += w.noLinkedIn;
  if (!e?.emails.length) s += w.noEmail;

  // Ihmal edilmis site: telif yili 2+ yil eski.
  if (t?.copyrightYear != null && t.copyrightYear <= new Date().getFullYear() - 2) s += w.staleSite;

  // Itibar sinyalleri.
  if (raw.rating != null) {
    if (raw.rating < 4.0) s += w.lowRating;
    else if (raw.rating < 4.5) s += w.midRating;
  }
  if (raw.reviewCount != null && raw.reviewCount < 50) s += w.fewReviews;

  return s;
}

/** Erisilebilir + koklu + butcesi olabilecek yerel isletme mi? */
function icp(raw: RawCompany, e: Enrichment | undefined): number {
  let s = 0;

  if (raw.phone) s += 25; // outreach icin ulasabilir olmak kritik
  if (e?.emails.length) s += 15; // ikinci kanal
  if (raw.website) s += 10; // dijitale yatirim yapiyor (bozuk bile olsa)

  // Kokluluk (yorum sayisi).
  const rc = raw.reviewCount ?? 0;
  if (rc >= 100) s += 25;
  else if (rc >= 30) s += 15;
  else if (rc >= 1) s += 8;

  // Kalite (puan).
  if (raw.rating != null) {
    if (raw.rating >= 4.5) s += 15;
    else if (raw.rating >= 4.0) s += 10;
    else s += 5;
  } else {
    s += 5; // bilinmiyor -> notr
  }

  if (e?.socials.instagram) s += 10;

  return s;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
