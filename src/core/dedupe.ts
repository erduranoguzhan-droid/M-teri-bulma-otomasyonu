import type { RawCompany } from "./types.js";

/** Ayni firmayi tekrar eklememek icin basit anahtar (website, yoksa isim|telefon). */
export function dedupeKey(raw: RawCompany): string {
  const site = raw.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return (site || `${raw.name}|${raw.phone ?? ""}`).toLowerCase().trim();
}
