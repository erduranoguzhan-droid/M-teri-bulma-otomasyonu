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
  { header: "LinkedIn", get: (l) => l.enrichment?.socials.linkedin },
  { header: "Google Puanı", get: (l) => l.raw.rating },
  { header: "Yorum Sayısı", get: (l) => l.raw.reviewCount },
  { header: "Lead Skor", get: (l) => l.analysis?.leadScore },
  { header: "ICP", get: (l) => l.analysis?.icpScore },
  { header: "Aciliyet", get: (l) => l.analysis?.urgencyScore },
  { header: "Bütçe", get: (l) => (l.analysis ? BUDGET_LABEL[l.analysis.budgetLevel] : "") },
  // Firma-bazlı AI intelligence kolonları (varsa dolar; yoksa boş).
  { header: "Tarama Modu", get: (l) => (l.scanMode === "company" ? "Firma AI" : "Sektör") },
  { header: "AI Uygunluk", get: (l) => l.intelligence?.scores.aiFitScore },
  { header: "Satın Alma Pot.", get: (l) => l.intelligence?.scores.buyingPotentialScore },
  { header: "Cold Outreach", get: (l) => l.intelligence?.scores.coldOutreachScore },
  { header: "Öncelik", get: (l) => l.intelligence?.scores.priorityScore },
  { header: "Dijital Olgunluk", get: (l) => l.intelligence?.scores.digitalMaturityScore },
  { header: "Karar Verici", get: (l) => l.intelligence?.contacts.length ?? "" },
  { header: "Teknoloji", get: (l) => intelTech(l) },
  { header: "Güven", get: (l) => l.intelligence?.confidence },
  { header: "Durum", get: (l) => CRM_STATUSES.find((s) => s.value === l.crmStatus)?.label ?? l.crmStatus },
  { header: "Önerilen Hizmet", get: (l) => l.analysis?.recommendedServices[0] },
  { header: "En Büyük Problem", get: (l) => l.analysis?.biggestProblem },
  { header: "İletişim Tarihi", get: (l) => l.contactedAt?.slice(0, 10) },
  { header: "Google Maps", get: (l) => l.raw.mapsUrl },
];

function intelTech(l: Lead): string {
  const t = l.intelligence?.technologies;
  if (!t) return "";
  return [...t.cms, ...t.frontend, ...t.crmMarketing, ...t.analytics].slice(0, 6).join(" ");
}

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
  download("﻿" + leadsToCsv(leads), filename, "text/csv;charset=utf-8;");
}

/** Tam lead verisini JSON olarak indir (Supabase/Postgres/Airtable/webhook beslemesi icin). */
export function downloadJson(leads: Lead[], filename = "vertex-leadler.json"): void {
  download(JSON.stringify(leads, null, 2), filename, "application/json;charset=utf-8;");
}

/**
 * Instantly / cold-email platformlari icin CSV. Yalniz e-postasi olan leadler;
 * kolonlar: email, first_name, company_name, subject, body (kisisellestirilmis).
 */
function firstEmail(l: Lead): string | undefined {
  return l.intelligence?.contacts.find((c) => c.email)?.email
    ?? l.enrichment?.salesEmail
    ?? l.enrichment?.emails[0];
}

export function leadsToInstantlyCsv(leads: Lead[]): string {
  const cols = ["email", "first_name", "company_name", "subject", "body"];
  const rows: string[] = [cols.join(",")];
  for (const l of leads) {
    const email = firstEmail(l);
    if (!email) continue;
    const body = l.intelligence?.outreach.coldEmailShort ?? l.outreach?.email.body ?? "";
    const subject = l.outreach?.email.subject ?? `${l.raw.name} için hızlı bir fikir`;
    rows.push([email, "", l.raw.name, subject, body].map(csvCell).join(","));
  }
  return rows.join("\r\n");
}

export function downloadInstantlyCsv(leads: Lead[], filename = "vertex-instantly.csv"): void {
  download("﻿" + leadsToInstantlyCsv(leads), filename, "text/csv;charset=utf-8;");
}

// Instantly virgul-ayrimli oldugu icin ayri kacis (ana export noktali-virgul).
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
