// Leadleri CSV'ye cevirir + tarayicidan indirir (client-side, sunucu gerekmez).
import type { Lead } from "./types";
import { CRM_STATUSES, BUDGET_LABEL } from "./types";
import { sectorFor, sectorLabel } from "./sectors";

const COLUMNS: { header: string; get: (l: Lead) => string | number | undefined }[] = [
  { header: "İsim", get: (l) => l.raw.name },
  { header: "Sektör", get: (l) => sectorLabel(sectorFor(l.raw)) },
  { header: "Kategori", get: (l) => l.raw.category },
  { header: "Şehir", get: (l) => l.raw.city },
  { header: "Telefon", get: (l) => l.raw.phone },
  { header: "Website", get: (l) => l.raw.website },
  { header: "E-posta", get: (l) => l.enrichment?.emails.join(" ") },
  { header: "Google Puanı", get: (l) => l.raw.rating },
  { header: "Yorum Sayısı", get: (l) => l.raw.reviewCount },
  { header: "Lead Skor", get: (l) => l.analysis?.leadScore },
  { header: "ICP", get: (l) => l.analysis?.icpScore },
  { header: "Aciliyet", get: (l) => l.analysis?.urgencyScore },
  { header: "Bütçe", get: (l) => (l.analysis ? BUDGET_LABEL[l.analysis.budgetLevel] : "") },
  { header: "Durum", get: (l) => CRM_STATUSES.find((s) => s.value === l.crmStatus)?.label ?? l.crmStatus },
  { header: "Önerilen Hizmet", get: (l) => l.analysis?.recommendedServices[0] },
  { header: "En Büyük Problem", get: (l) => l.analysis?.biggestProblem },
  { header: "İletişim Tarihi", get: (l) => l.contactedAt?.slice(0, 10) },
  { header: "Google Maps", get: (l) => l.raw.mapsUrl },
];

function cell(v: string | number | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // CSV kacisi: tirnak/virgul/yenisatir varsa cift tirnakla sar.
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(leads: Lead[]): string {
  const head = COLUMNS.map((c) => c.header).join(";");
  const rows = leads.map((l) => COLUMNS.map((c) => cell(c.get(l))).join(";"));
  return [head, ...rows].join("\r\n");
}

/** CSV'yi UTF-8 BOM ile indir (Excel Turkce karakterleri dogru acar). */
export function downloadCsv(leads: Lead[], filename = "vertex-leadler.csv"): void {
  const csv = leadsToCsv(leads);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
