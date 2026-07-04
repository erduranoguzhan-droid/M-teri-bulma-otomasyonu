// CLI src/core/scoring.ts sinyallerinin gorsel aynasi ("neden bu skor").
// Skor zaten deterministik hesaplanip kaydedildi; burada sadece hangi
// sinyallerin skoru olusturdugunu SEFFAF gostermek icin ayni mantigi yansitiriz.
// v2: aciliyet agirliklari SEKTORE gore degisir (scoring.ts SECTOR_URGENCY aynasi).
import type { Lead } from "./types";
import { sectorFor } from "./sectors";

export interface Signal { label: string; weight: number; }

interface UrgencyWeights {
  noWebsite: number; unreachable: number; noWhatsApp: number; noOnlineOrdering: number;
  noReservation: number; noAnalytics: number; noMetaPixel: number; noInstagram: number;
  noLinkedIn: number; noEmail: number; staleSite: number; lowRating: number; midRating: number; fewReviews: number;
}
const BASE: UrgencyWeights = {
  noWebsite: 35, unreachable: 32, noWhatsApp: 10, noOnlineOrdering: 12, noReservation: 6,
  noAnalytics: 6, noMetaPixel: 8, noInstagram: 8, noLinkedIn: 0, noEmail: 5, staleSite: 8,
  lowRating: 10, midRating: 5, fewReviews: 6,
};
const SECTOR_URGENCY: Record<string, UrgencyWeights> = {
  "restoran-kafe": BASE,
  "saglik-klinik": { ...BASE, noOnlineOrdering: 0, noReservation: 14, noWhatsApp: 12, noInstagram: 10, noMetaPixel: 8, lowRating: 12, fewReviews: 8 },
  "eticaret-perakende": { ...BASE, noOnlineOrdering: 15, noReservation: 0, noWhatsApp: 10, noAnalytics: 10, noMetaPixel: 12, noInstagram: 8, noEmail: 8 },
  "uretim-sanayi": { ...BASE, noOnlineOrdering: 0, noReservation: 0, noWhatsApp: 0, noInstagram: 0, noLinkedIn: 10, noMetaPixel: 4, noAnalytics: 8, noEmail: 15, lowRating: 5, midRating: 2, fewReviews: 3 },
  genel: { ...BASE, noOnlineOrdering: 6, noReservation: 3, noInstagram: 6 },
};
function weightsFor(sector: string): UrgencyWeights {
  return SECTOR_URGENCY[sector] ?? BASE;
}

export const BUDGET_FACTOR: Record<"dusuk" | "orta" | "yuksek", number> = {
  dusuk: 30,
  orta: 65,
  yuksek: 100,
};

// Formul: leadScore = 0.45*aciliyet + 0.35*icp + 0.20*butce
export const SCORE_WEIGHTS = { urgency: 0.45, icp: 0.35, budget: 0.2 };

/** Aciliyeti yukselten EKSIKLER (bosluk = firsat). Sektore gore agirlikli;
 *  agirligi 0 olan (o sektor icin alakasiz) sinyaller gosterilmez. */
export function urgencySignals(lead: Lead): Signal[] {
  const { raw, enrichment: e } = lead;
  const t = e?.tech;
  const w = weightsFor(sectorFor(raw));
  const s: Signal[] = [];
  const add = (cond: boolean, label: string, weight: number) => {
    if (cond && weight > 0) s.push({ label, weight });
  };
  if (!raw.website) add(true, "Website yok", w.noWebsite);
  else add(!e?.websiteReachable, "Website erişilemiyor", w.unreachable);
  add(!t?.hasWhatsApp, "WhatsApp entegrasyonu yok", w.noWhatsApp);
  add(!t?.hasOnlineOrdering, "Online sipariş yok", w.noOnlineOrdering);
  add(!t?.hasReservation, "Rezervasyon yok", w.noReservation);
  add(!t?.hasGoogleAnalytics, "Ölçüm/Analytics yok", w.noAnalytics);
  add(!t?.hasMetaPixel, "Reklam pikseli yok", w.noMetaPixel);
  add(!e?.socials.instagram, "Instagram yok", w.noInstagram);
  add(!e?.socials.linkedin, "LinkedIn yok", w.noLinkedIn);
  add(!e?.emails.length, "E-posta bulunamadı", w.noEmail);
  const staleY = new Date().getFullYear() - 2;
  add(t?.copyrightYear != null && t.copyrightYear <= staleY, `Site güncel değil (${t?.copyrightYear})`, w.staleSite);
  if (raw.rating != null) {
    add(raw.rating < 4.0, `Düşük puan (${raw.rating})`, w.lowRating);
    add(raw.rating >= 4.0 && raw.rating < 4.5, `Orta puan (${raw.rating})`, w.midRating);
  }
  add(raw.reviewCount != null && raw.reviewCount < 50, `Az yorum (${raw.reviewCount})`, w.fewReviews);
  return s;
}

/** ICP'yi yukselten ARTILAR (erisilebilir + koklu). */
export function icpSignals(lead: Lead): Signal[] {
  const { raw, enrichment: e } = lead;
  const s: Signal[] = [];
  if (raw.phone) s.push({ label: "Telefon var", weight: 25 });
  if (e?.emails.length) s.push({ label: "E-posta var", weight: 15 });
  if (raw.website) s.push({ label: "Website var", weight: 10 });
  const rc = raw.reviewCount ?? 0;
  if (rc >= 100) s.push({ label: `Köklü (${rc} yorum)`, weight: 25 });
  else if (rc >= 30) s.push({ label: `${rc} yorum`, weight: 15 });
  else if (rc >= 1) s.push({ label: `${rc} yorum`, weight: 8 });
  if (raw.rating != null) {
    if (raw.rating >= 4.5) s.push({ label: `Yüksek puan (${raw.rating})`, weight: 15 });
    else if (raw.rating >= 4.0) s.push({ label: `İyi puan (${raw.rating})`, weight: 10 });
    else s.push({ label: `Puan ${raw.rating}`, weight: 5 });
  }
  if (e?.socials.instagram) s.push({ label: "Instagram aktif", weight: 10 });
  return s;
}
