import { z } from "zod";
import type { Analysis, Outreach, RawCompany } from "../../core/types.js";
import { llmJson } from "../../core/llm.js";
import { sectorFor, toneFor } from "../../core/services.js";

const OutreachSchema = z.object({
  whatsapp: z.string(),
  email: z.object({ subject: z.string(), body: z.string() }),
});

export async function generateOutreach(
  raw: RawCompany,
  analysis: Analysis,
  sector?: string,
): Promise<Outreach> {
  const sec = sector ?? sectorFor(raw);
  const system = [
    "Sen Vertex adli AI otomasyon ajansi adina yazan, donusum odakli bir satis metni yazarisin.",
    "Gorevin: bu sirkete ozel, ASLA sablon gibi gorunmeyen kisa outreach mesajlari yazmak.",
    "",
    `Bu sirket sektoru: ${sec}. Mesaj tonunu ASAGIDAKI sektor rehberine gore ayarla:`,
    toneFor(sec),
    "",
    "Genel kurallar:",
    "- Turkce; nazik 'siz' dili.",
    "- Ilk cumlede sirketi gercekten inceledigini belli et (isim, sehir veya somut bir detay).",
    "- Tespit edilen problemi nazikce ima et, ardindan tek bir net fayda sun.",
    "- Agir satis yapma; amac cevap almak / kisa gorusme ayarlamak.",
    "- WhatsApp mesaji cok kisa (maks ~4 cumle).",
    "- E-posta biraz daha detayli ama yine kisa; net bir soru/CTA ile bitir.",
    "- Fiyat verme, teknik jargon kullanma.",
    "- Ton rehberi emoji/kanal konusunda ne diyorsa ONA uy (or. B2B'de emoji yok).",
    "",
    "JSON alanlari (hepsi zorunlu):",
    "  whatsapp (string),",
    "  email (nesne: { subject: string, body: string }).",
  ].join("\n");

  const user = [
    `Sirket: ${raw.name}`,
    raw.city ? `Sehir: ${raw.city}` : "",
    raw.category ? `Kategori: ${raw.category}` : "",
    "",
    `Tespit edilen en buyuk problem: ${analysis.biggestProblem}`,
    `En kolay otomasyon firsati: ${analysis.easiestAutomation}`,
    `Onerilen ana hizmet: ${analysis.recommendedServices[0] ?? "AI otomasyon"}`,
    `Satis argumani (ROI): ${analysis.bestRoiPitch}`,
  ]
    .filter(Boolean)
    .join("\n");

  return llmJson({ system, user, schema: OutreachSchema, maxTokens: 1200 });
}
