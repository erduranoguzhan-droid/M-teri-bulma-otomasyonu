import { z } from "zod";
import type { Analysis, Enrichment, RawCompany } from "../../core/types.js";
import { llmJson } from "../../core/llm.js";
import { computeScores } from "../../core/scoring.js";
import { VERTEX_SERVICES, playbookFor, sectorFor } from "../../core/services.js";

// LLM sadece NITEL kismi + butce seviyesini uretir.
// Sayisal skorlar (leadScore/icp/urgency) koddan deterministik hesaplanir.
const QualitativeSchema = z.object({
  biggestProblem: z.string(),
  timeWaster: z.string(),
  easiestAutomation: z.string(),
  recommendedServices: z.array(z.string()),
  bestRoiPitch: z.string(),
  budgetLevel: z.enum(["dusuk", "orta", "yuksek"]),
  reasoning: z.string(),
});

export async function analyzeCompany(
  raw: RawCompany,
  enrichment: Enrichment | undefined,
  sector?: string,
): Promise<Analysis> {
  // Sektor verilmediyse kategori/isimden otomatik tespit et.
  const sec = sector ?? sectorFor(raw);
  const system = [
    "Sen Vertex adli bir AI otomasyon ajansinin en iyi B2B satis analistisin.",
    "Gorevin: verilen sirketi analiz edip Vertex'in hangi hizmetini satabilecegini belirlemek.",
    `Bu sirket tespit edilen sektor: ${sec}. Analizini bu sektorun dinamiklerine gore yap.`,
    "",
    "Vertex'in sunabilecegi hizmetler (recommendedServices SADECE bu listeden secilecek):",
    VERTEX_SERVICES.map((s) => `- ${s}`).join("\n"),
    "",
    playbookFor(sec),
    "",
    "budgetLevel: isletme buyuklugune gore tahmini butce -> 'dusuk' | 'orta' | 'yuksek'.",
    "(Sayisal skorlari sen verme; onlar ayrica hesaplaniyor.)",
    "",
    "JSON alanlari (hepsi zorunlu):",
    "  biggestProblem, timeWaster, easiestAutomation (string),",
    "  recommendedServices (string dizisi), bestRoiPitch (string),",
    "  budgetLevel (enum), reasoning (string).",
    "Tum metin alanlarini TURKCE ve kisa/net yaz. Genel klise yazma; bu sirkete ozel ol.",
  ].join("\n");

  const q = await llmJson({
    system,
    user: buildContext(raw, enrichment),
    schema: QualitativeSchema,
    maxTokens: 1200,
  });

  const scores = computeScores(raw, enrichment, q.budgetLevel, sec);
  return { ...q, ...scores };
}

function buildContext(raw: RawCompany, e: Enrichment | undefined): string {
  const lines: string[] = [
    `Sirket: ${raw.name}`,
    raw.category ? `Kategori: ${raw.category}` : "",
    raw.city ? `Sehir: ${raw.city}` : "",
    raw.address ? `Adres: ${raw.address}` : "",
    raw.phone ? `Telefon: ${raw.phone}` : "",
    raw.website ? `Website: ${raw.website}` : "Website: YOK",
    raw.rating != null ? `Google Puani: ${raw.rating} (${raw.reviewCount ?? 0} yorum)` : "Google Puani: bilinmiyor",
  ];

  if (e?.websiteReachable) {
    const t = e.tech;
    lines.push(
      "",
      "Website teknik durumu:",
      `- Sayfa basligi: ${e.websiteTitle ?? "-"}`,
      `- Google Analytics: ${yn(t.hasGoogleAnalytics)}`,
      `- Meta Pixel (reklam): ${yn(t.hasMetaPixel)}`,
      `- WhatsApp entegrasyonu: ${yn(t.hasWhatsApp)}`,
      `- Online siparis: ${yn(t.hasOnlineOrdering)}`,
      `- Rezervasyon: ${yn(t.hasReservation)}`,
      `- Canli destek/chat: ${yn(t.hasLiveChat)}`,
      `- E-ticaret platformu: ${t.ecommercePlatform ?? "yok"}`,
      `- Bulunan e-postalar: ${e.emails.length ? e.emails.join(", ") : "yok"}`,
      `- Instagram: ${e.socials.instagram ?? "yok"}`,
      e.pageTextSnippet ? `\nWebsite metninden ozet:\n${e.pageTextSnippet}` : "",
    );
  } else if (raw.website) {
    lines.push("", "Website verilmis ama erisilemedi/tarama basarisiz (muhtemelen zayif dijital altyapi).");
  }

  return lines.filter(Boolean).join("\n");
}

function yn(b: boolean): string {
  return b ? "VAR" : "yok";
}
