// CLI src/core/services.ts sectorFor mantiginin client-safe aynasi.
// Kaynak degisirse ikisini birlikte guncelle.

export const SECTOR_META: { key: string; label: string; emoji: string }[] = [
  { key: "restoran-kafe", label: "Restoran / Kafe", emoji: "☕" },
  { key: "saglik-klinik", label: "Sağlık / Klinik", emoji: "🩺" },
  { key: "eticaret-perakende", label: "E-ticaret / Perakende", emoji: "🛍️" },
  { key: "uretim-sanayi", label: "Üretim / Sanayi", emoji: "🏭" },
  { key: "genel", label: "Genel", emoji: "•" },
];

export function sectorLabel(key: string): string {
  return SECTOR_META.find((s) => s.key === key)?.label ?? "Genel";
}

export function sectorEmoji(key: string): string {
  return SECTOR_META.find((s) => s.key === key)?.emoji ?? "•";
}

const SECTOR_KEYWORDS: [sector: string, keywords: string[]][] = [
  ["uretim-sanayi", ["ilac", "farma", "pharma", "kimya", "fabrika", "sanayi", "uretim", "makine", "endustri", "metal", "plastik", "tekstil uretim"]],
  ["saglik-klinik", ["klinik", "hastane", "poliklinik", "dis", "dent", "medikal", "estetik", "guzellik", "spa", "saglik", "tip merkezi", "fizyoterapi", "eczane", "veteriner", "doktor", "asi"]],
  ["eticaret-perakende", ["magaza", "butik", "giyim", "moda", "market", "perakende", "eticaret", "e-ticaret", "online satis", "store", "shop", "ayakkabi", "aksesuar", "mobilya"]],
  ["restoran-kafe", ["kafe", "cafe", "restoran", "restaurant", "kahve", "coffee", "cay", "firin", "pastane", "lokanta", "yemek", "bistro", "pizza", "burger", "tatli", "cikolata", "kitchen", "bar"]],
];

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Kelime siniri eslesmesi ("asi" artik "magazasi" icinde eslesmez).
function keywordMatches(hay: string, keyword: string): boolean {
  return new RegExp(`(?:^|\\W)${escapeRegex(keyword)}(?:\\W|$)`).test(hay);
}

export function sectorFor(input: { category?: string; name?: string }): string {
  const hay = normalize(`${input.category ?? ""} ${input.name ?? ""}`);
  for (const [sector, keywords] of SECTOR_KEYWORDS) {
    if (keywords.some((k) => keywordMatches(hay, k))) return sector;
  }
  return "genel";
}
