// Pipeline deger & donusum analizi (CAC/LTV'ye ilk adim).
// Gercek anlasma tutari henuz girilmedigi icin degeri butce seviyesinden TAHMIN ederiz;
// lead asamasi ilerledikce agirlikli (beklenen) deger gerceklesir.
import type { CrmStatus, Lead } from "./types";

// Tahmini proje degeri (TRY) — butce seviyesine gore. Ajansin hizmet fiyat araligi.
const BUDGET_VALUE: Record<"dusuk" | "orta" | "yuksek", number> = {
  dusuk: 15000,
  orta: 35000,
  yuksek: 75000,
};

// Her CRM asamasinin kapanma olasiligi (tipik B2B huni).
export const STAGE_PROBABILITY: Record<CrmStatus, number> = {
  yeni: 0.05,
  iletisim_kuruldu: 0.1,
  yanit_bekleniyor: 0.15,
  toplanti_planlandi: 0.3,
  teklif_gonderildi: 0.5,
  muzakere: 0.7,
  kazanildi: 1,
  kaybedildi: 0,
  takip: 0.08,
};

export function budgetEstimate(lead: Lead): number {
  if (!lead.analysis) return 0;
  return BUDGET_VALUE[lead.analysis.budgetLevel] ?? 0;
}

export function estimatedValue(lead: Lead): number {
  if (lead.dealValue != null) return lead.dealValue; // elle girilen deger onceliklidir
  return budgetEstimate(lead);
}

export interface PipelineStats {
  openValue: number; // acik (kazanilmamis/kaybedilmemis) toplam potansiyel
  weightedValue: number; // acik leadlerin asama-olasilikli beklenen degeri
  wonValue: number; // kazanilan gerceklesmis deger
  lostValue: number;
  winRate: number | null; // kazanildi / (kazanildi + kaybedildi)
  contactRate: number | null; // iletisime gecilen / toplam
  wonCount: number;
  lostCount: number;
  contactedCount: number;
  total: number;
}

export function computePipelineStats(leads: Lead[]): PipelineStats {
  const isClosed = (s: CrmStatus) => s === "kazanildi" || s === "kaybedildi";
  let openValue = 0;
  let weightedValue = 0;
  let wonValue = 0;
  let lostValue = 0;
  let wonCount = 0;
  let lostCount = 0;
  let contactedCount = 0;

  for (const l of leads) {
    const v = estimatedValue(l);
    const s = l.crmStatus;
    if (l.contactedAt || (s !== "yeni" && !isClosed(s))) contactedCount++;
    if (s === "kazanildi") {
      wonValue += v;
      wonCount++;
    } else if (s === "kaybedildi") {
      lostValue += v;
      lostCount++;
    } else {
      openValue += v;
      weightedValue += v * STAGE_PROBABILITY[s];
    }
  }

  return {
    openValue,
    weightedValue: Math.round(weightedValue),
    wonValue,
    lostValue,
    winRate: wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null,
    contactRate: leads.length > 0 ? contactedCount / leads.length : null,
    wonCount,
    lostCount,
    contactedCount,
    total: leads.length,
  };
}

export function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(x: number | null): string {
  return x == null ? "—" : `%${Math.round(x * 100)}`;
}
