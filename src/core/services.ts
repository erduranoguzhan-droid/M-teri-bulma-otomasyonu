// Vertex'in satabilecegi hizmetler + sektor bazli eslestirme ipuclari.
// Analyzer bu katalogu LLM'e baglam olarak verir; boylece onerilen hizmetler
// bizim gercekten sundugumuz seylerden secilir (halusinasyonu azaltir).

export const VERTEX_SERVICES = [
  // AI Agent
  "Musteri Destek AI Agent",
  "Satis/Outreach AI Agent",
  "Icerik Uretim AI Agent",
  "WhatsApp Bot",
  "AI Voice Agent (telefon)",
  "Rezervasyon/Randevu Botu",
  "Google Yorum Otomasyonu",
  // Web & Yazilim
  "Kurumsal Web Sitesi",
  "Landing Page",
  "Online Siparis / Menu Sistemi",
  "CRM Kurulumu",
  "Sadakat / Puan Sistemi",
  "E-posta Otomasyonu",
  "Meta (Instagram/Facebook) Reklam Otomasyonu",
  "Google Ads Otomasyonu",
  // Danismanlik
  "AI Adaptasyon Yol Haritasi",
  "Otomasyon Stratejisi Calistayi",
] as const;

/**
 * Sektore ozel hangi hizmetlerin oncelikli oldugunu LLM'e hatirlatir.
 * Analyzer, lead'in kategorisinden tespit edilen sektorun playbook'unu baglam verir.
 */
export const SECTOR_PLAYBOOK: Record<string, string> = {
  "restoran-kafe": [
    "Restoran/kafe icin en yuksek ROI genelde su siralamada gelir:",
    "1) WhatsApp Bot + Rezervasyon Botu (telefon trafigini otomatiklestirir)",
    "2) Google Yorum Otomasyonu (dusuk puan/az yorum varsa itibar yonetimi)",
    "3) Online Siparis / Menu Sistemi (website'de siparis yoksa buyuk firsat)",
    "4) Sadakat/Puan Sistemi + CRM (tekrar eden musteri kazanimi)",
    "5) Meta Reklam Otomasyonu (Instagram aktifse gorsel pazarlama)",
  ].join("\n"),

  "saglik-klinik": [
    "Klinik/saglik/estetik icin oncelik sirasi:",
    "1) Randevu/Randevu Botu + WhatsApp (randevu trafigi ve no-show azaltma)",
    "2) Google Yorum Otomasyonu (hasta guveni icin itibar KRITIK)",
    "3) Musteri Destek AI Agent (fiyat/prosedur/SSS 7/24 yanit)",
    "4) CRM + hatirlatma otomasyonu (kontrol randevusu, tekrar eden hasta)",
    "5) Meta Reklam Otomasyonu (estetik/guzellikte gorsel pazarlama guclu)",
    "Not: KVKK/hasta verisi hassas; mesaj dili guven odakli olmali.",
  ].join("\n"),

  "eticaret-perakende": [
    "E-ticaret/perakende/magaza icin oncelik sirasi:",
    "1) Musteri Destek AI Agent + WhatsApp Bot (siparis/kargo/iade sorulari hacimli)",
    "2) Meta + Google Ads Otomasyonu (satis dogrudan reklamdan gelir)",
    "3) E-posta Otomasyonu (sepet terk, geri kazanim, kampanya)",
    "4) Sadakat/Puan Sistemi + CRM (musteri yasam boyu degeri)",
    "5) Icerik Uretim AI Agent (urun aciklamasi, sosyal medya icerigi olceklenir)",
  ].join("\n"),

  "uretim-sanayi": [
    "Uretim/sanayi/ilac/kimya (B2B) icin oncelik sirasi — dikkat: bunlar B2B, uzun satis dongusu:",
    "1) Kurumsal Web Sitesi (cogu zaman eski/zayif dijital altyapi; ilk izlenim kritik)",
    "2) Satis/Outreach AI Agent + E-posta Otomasyonu (B2B lead-gen ve bayi kazanimi)",
    "3) CRM Kurulumu (bayi/distributor/musteri yonetimi)",
    "4) Icerik Uretim AI Agent (teknik dokuman, LinkedIn, ihracat pazarlama)",
    "5) AI Adaptasyon Yol Haritasi (kurumsal donusum danismanligi)",
    "Not: WhatsApp/rezervasyon botu UYGUN DEGIL; tuketici degil kurumsal alici hedeflenir.",
  ].join("\n"),

  genel: [
    "Sektore ozel net bir kalip yok; su genel cerceveyle degerlendir:",
    "1) Dijital gorunurluk eksigi (website yok/zayif) -> Web Sitesi/Landing Page",
    "2) Musteri iletisimi manuel/yavas -> WhatsApp Bot / Musteri Destek AI Agent",
    "3) Tekrar eden is/musteri -> CRM + E-posta Otomasyonu",
    "4) Buyume reklamdan geliyorsa -> Meta/Google Ads Otomasyonu",
  ].join("\n"),
};

// Kategori/isim anahtar kelimelerinden sektor tespiti. Ilk eslesen kazanir,
// o yuzden guclu/spesifik sinyaller once. Turkce aksani normalize ederiz.
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

// KELIME SINIRI eslesmesi: "asi" (asi) artik "magazASI"/"nisantASI" icinde
// eslesmez; substring yerine tam kelime araniyor.
function keywordMatches(hay: string, keyword: string): boolean {
  return new RegExp(`(?:^|\\W)${escapeRegex(keyword)}(?:\\W|$)`).test(hay);
}

/** Lead'in kategori + isminden sektor kodunu tahmin eder. */
export function sectorFor(input: { category?: string; name?: string }): string {
  const hay = normalize(`${input.category ?? ""} ${input.name ?? ""}`);
  for (const [sector, keywords] of SECTOR_KEYWORDS) {
    if (keywords.some((k) => keywordMatches(hay, k))) return sector;
  }
  return "genel";
}

export function playbookFor(sector: string): string {
  return SECTOR_PLAYBOOK[sector] ?? SECTOR_PLAYBOOK.genel ?? "";
}

/**
 * Sektore ozel OUTREACH TONU. Ayni mesaj sablonu her sektore uymaz:
 * bir ilac fabrikasina (B2B) yazilan mesaj ile bir kafeye yazilan farkli olmali.
 */
export const SECTOR_TONE: Record<string, string> = {
  "restoran-kafe": [
    "TON: Sicak, yerel, samimi ama profesyonel. Isletme sahibiyle dogrudan konusur gibi.",
    "- WhatsApp birincil kanal; kisa, gunluk dille, tek emoji serbest.",
    "- Somut yerel detay kullan (mahalle, mutfak, Google yorumlari).",
    "- Hizli kurulum ve aninda etkiyi vurgula.",
  ].join("\n"),
  "saglik-klinik": [
    "TON: Guven veren, olculu, saygili. Hasta mahremiyetine duyarli.",
    "- Abartili vaat yok; itibar ve hasta deneyimi vurgusu.",
    "- KVKK/gizlilik hassasiyetini ima et (veri guvenli islenir).",
    "- WhatsApp/e-posta dengeli; dil profesyonel-sicak.",
  ].join("\n"),
  "eticaret-perakende": [
    "TON: Sonuc/ROI odakli, enerjik, net rakamsal fayda.",
    "- Satis/donusum artisi, otomasyonla kazanilan zaman/gelir on planda.",
    "- Hizli entegrasyon ve olceklenebilirlik vurgusu.",
  ].join("\n"),
  "uretim-sanayi": [
    "TON: KURUMSAL, resmi, B2B. Tuketici dili DEGIL; is ortakligi dili.",
    "- 'Siz' resmi; emoji YOK. Karar verici / yetkiliye hitap.",
    "- E-posta birincil kanal (WhatsApp bile resmi ve kisa olmali).",
    "- Vurgu: kurumsal itibar, B2B lead-gen, distributor/bayi kazanimi, ihracat, verimlilik.",
    "- Randevu/siparis botu gibi tuketici cozumlerinden BAHSETME.",
  ].join("\n"),
  genel: [
    "TON: Profesyonel, net, sicak. Isletme tipine gore dengeli.",
    "- Somut bir detayla baslayip tek net fayda sun.",
  ].join("\n"),
};

export function toneFor(sector: string): string {
  return SECTOR_TONE[sector] ?? SECTOR_TONE.genel ?? "";
}
