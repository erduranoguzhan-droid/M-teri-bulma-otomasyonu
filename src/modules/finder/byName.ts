// Firma ADIYLA bulma. Mevcut Google Maps finder'ini yeniden kullanir (googleMaps.ts
// degismez); en iyi eslesmeyi alir ve Maps URL'inden koordinat/placeId cikarir.
// Bulunamazsa minimal RawCompany { name } doner (pipeline yine calisir; veri seyrek olur).

import type { RawCompany } from "../../core/types.js";
import { findCompanies } from "./googleMaps.js";

export interface FindByNameOptions {
  name: string;
  country?: string;
  city?: string;
}

export async function findCompanyByName(opts: FindByNameOptions): Promise<RawCompany> {
  const query = [opts.name, opts.city, opts.country].filter(Boolean).join(" ").trim();
  let results: RawCompany[] = [];
  try {
    // Birkac aday cek; ilkini korlemesine almak yerine ISME EN COK BENZEYEni sec.
    // (Marka aramalarinda Maps ilk sirada alakasiz bir yer donebiliyor.)
    results = await findCompanies({ query, maxResults: 5 });
  } catch {
    results = [];
  }

  // En iyi isim eslesmesini bul.
  let best: RawCompany | undefined;
  let bestScore = 0;
  for (const r of results) {
    const s = nameMatchScore(opts.name, r.name);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }

  // Yeterince benzeyen sonuc yoksa: YANLIS firmayi atfetme (website/telefon karismasin);
  // minimal kayit don. deepEnrich website olmadan "erisilemedi" isaretler (uydurma yok).
  if (!best || bestScore < 0.5) {
    return { name: opts.name, country: opts.country, city: opts.city };
  }

  // Koordinat/placeId'yi Maps URL'inden cikar (varsa).
  const coords = parseMapsUrl(best.mapsUrl);
  return {
    ...best,
    name: best.name || opts.name,
    country: best.country ?? opts.country,
    ...coords,
  };
}

/**
 * Hedef isim ile aday isim benzerligi 0-1. Hedef kelimelerinin kaci adayda geciyor.
 * "yemeksepeti" -> "Yemeksepeti Park" = 1.0 ; "getir" -> "Maydonoz Döner" = 0.
 */
function nameMatchScore(target: string, candidate: string): number {
  const norm = (s: string) =>
    s.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/gi, " ").trim();
  const tokens = norm(target).split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return 0;
  const cand = norm(candidate);
  const hits = tokens.filter((t) => cand.includes(t)).length;
  return hits / tokens.length;
}

/** Google Maps place URL'inden lat/lng ve place kimligini ayiklar. */
function parseMapsUrl(url?: string): Pick<RawCompany, "lat" | "lng" | "placeId"> {
  if (!url) return {};
  const out: Pick<RawCompany, "lat" | "lng" | "placeId"> = {};
  // "!3d40.98!4d29.02" veya "@40.98,29.02" formatlari.
  const dm = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const am = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const lat = dm?.[1] ?? am?.[1];
  const lng = dm?.[2] ?? am?.[2];
  if (lat && lng) {
    out.lat = Number(lat);
    out.lng = Number(lng);
  }
  // Place kimligi: "1s0x14cab...:0x..." parcasi.
  const pid = url.match(/1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (pid?.[1]) out.placeId = pid[1];
  return out;
}
