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
  let best: RawCompany | undefined;
  try {
    const results = await findCompanies({ query, maxResults: 1 });
    best = results[0];
  } catch {
    best = undefined;
  }

  if (!best) {
    // Maps'te bulunamadi -> minimal kayit. Enrichment website olmadan sinirli calisir.
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
