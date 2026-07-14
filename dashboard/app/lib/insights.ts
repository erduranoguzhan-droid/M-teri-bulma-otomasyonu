// Insights sayfasi icin analitik hesap katmani (saf fonksiyonlar; Lead[] -> grafik verisi).
// Mevcut pipeline/sector/score mantigini yeniden kullanir. Sunucu tarafinda hesaplanir.
import type { Lead } from "./types";
import { sectorFor, SECTOR_META } from "./sectors";
import { computePipelineStats } from "./pipeline";

// dataviz: sektor kategorik paleti (SABIT SIRA — validate_palette ile dogrulandi, CVD 24.2).
// restoran-kafe, saglik-klinik, eticaret-perakende, uretim-sanayi, genel
export const SECTOR_COLORS: Record<string, string> = {
  "restoran-kafe": "#2a78d6",
  "saglik-klinik": "#1baf7a",
  "eticaret-perakende": "#eda100",
  "uretim-sanayi": "#008300",
  genel: "#4a3aa7",
};

// Skor bantlari (ordinal kalite rampasi — uygulamada tutarli).
export const BANDS = [
  { key: "hot", label: "Sıcak 75+", min: 75, color: "#ef7d70" },
  { key: "warm", label: "Ilık 60-74", min: 60, color: "#e0b04a" },
  { key: "mid", label: "Orta 40-59", min: 40, color: "#4a9d92" },
  { key: "low", label: "Düşük <40", min: 0, color: "#c2c8cf" },
] as const;

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  meta?: string; // tooltip'te gosterilecek ek bilgi
}

function bandOf(score: number): (typeof BANDS)[number] {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

/** Skor dagilimi: her bantta kac lead. */
export function scoreDistribution(leads: Lead[]): BarDatum[] {
  const scored = leads.filter((l) => l.analysis);
  return BANDS.map((b) => ({
    label: b.label,
    value: scored.filter((l) => bandOf(l.analysis!.leadScore ?? 0).key === b.key).length,
    color: b.color,
  }));
}

/** Sektor dagilimi: lead sayisi + ortalama skor (meta). */
export function sectorDistribution(leads: Lead[]): BarDatum[] {
  const rows = SECTOR_META.map((s) => {
    const inSec = leads.filter((l) => sectorFor(l.raw) === s.key);
    const scored = inSec.filter((l) => l.analysis);
    const avg = scored.length
      ? Math.round(scored.reduce((sum, l) => sum + (l.analysis!.leadScore ?? 0), 0) / scored.length)
      : 0;
    return {
      label: `${s.emoji} ${s.label}`,
      value: inSec.length,
      color: SECTOR_COLORS[s.key],
      meta: scored.length ? `ort. skor ${avg}` : undefined,
    };
  });
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

/** En cok onerilen hizmetler (analiz + intelligence.recommendedServices birlesik). */
export function serviceDemand(leads: Lead[], top = 8): BarDatum[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const fromAnalysis = l.analysis?.recommendedServices ?? [];
    const fromIntel = l.intelligence?.recommendedServices.map((s) => s.service) ?? [];
    for (const svc of new Set([...fromAnalysis, ...fromIntel])) {
      counts.set(svc, (counts.get(svc) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

/** Rakip analizi olan leadlerde: hangi yetenekte kac lead GERIDE (pazar boslugu). */
export function competitorGapDemand(leads: Lead[]): BarDatum[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    for (const cap of l.intelligence?.competitors?.behindOn ?? []) {
      counts.set(cap, (counts.get(cap) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Rakip baskisi dagilimi (dusuk/orta/yuksek) — firma modu leadleri. */
export function pressureDistribution(leads: Lead[]): BarDatum[] {
  const withComp = leads
    .map((l) => l.intelligence?.competitors?.competitivePressureScore)
    .filter((n): n is number => n != null);
  const bucket = (min: number, max: number) => withComp.filter((n) => n >= min && n <= max).length;
  return [
    { label: "Düşük 0-33", value: bucket(0, 33), color: "#c2c8cf" },
    { label: "Orta 34-66", value: bucket(34, 66), color: "#e0b04a" },
    { label: "Yüksek 67+", value: bucket(67, 100), color: "#ef7d70" },
  ];
}

export interface InsightsSummary {
  total: number;
  analyzed: number;
  hot: number;
  avgScore: number;
  companyMode: number;
  withCompetitors: number;
  avgPressure: number | null;
  avgLeadMaturity: number | null;
  avgCompetitorMaturity: number | null;
  won: number;
  winRate: number | null;
  contactRate: number | null;
  openValue: number;
  weightedValue: number;
  wonValue: number;
}

export function insightsSummary(leads: Lead[]): InsightsSummary {
  const analyzedLeads = leads.filter((l) => l.analysis);
  const avgScore = analyzedLeads.length
    ? Math.round(analyzedLeads.reduce((s, l) => s + (l.analysis!.leadScore ?? 0), 0) / analyzedLeads.length)
    : 0;
  const comps = leads
    .map((l) => l.intelligence?.competitors)
    .filter((c): c is NonNullable<typeof c> => c != null);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null);
  const pipe = computePipelineStats(leads);

  return {
    total: leads.length,
    analyzed: analyzedLeads.length,
    hot: analyzedLeads.filter((l) => (l.analysis!.leadScore ?? 0) >= 75).length,
    avgScore,
    companyMode: leads.filter((l) => l.scanMode === "company").length,
    withCompetitors: comps.length,
    avgPressure: avg(comps.map((c) => c.competitivePressureScore)),
    avgLeadMaturity: avg(comps.map((c) => c.leadDigitalMaturity)),
    avgCompetitorMaturity: avg(comps.map((c) => c.avgCompetitorMaturity)),
    won: pipe.wonCount,
    winRate: pipe.winRate,
    contactRate: pipe.contactRate,
    openValue: pipe.openValue,
    weightedValue: pipe.weightedValue,
    wonValue: pipe.wonValue,
  };
}

