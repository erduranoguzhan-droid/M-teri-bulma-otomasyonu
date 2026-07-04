// Lead'in CRM asamasina gore "sonraki en iyi aksiyon" onerisi (detay sayfasi banner'i).
import type { Lead } from "./types";

export interface NextAction {
  label: string;
  hint: string;
  tone: "go" | "warm" | "wait" | "won" | "lost";
}

export function nextAction(lead: Lead): NextAction {
  const s = lead.crmStatus;
  if (s === "kazanildi")
    return { label: "Onboarding başlat", hint: "Anlaşma kazanıldı — hizmet kurulumu ve ilk teslimata geç.", tone: "won" };
  if (s === "kaybedildi")
    return { label: "İleride tekrar dene", hint: "Kaybedildi olarak işaretli; ~6 ay sonra yeniden değerlendir.", tone: "lost" };
  if (!lead.outreach)
    return { label: "Mesaj bekliyor", hint: "Bu lead için henüz outreach üretilmedi (analiz/teklif aşaması).", tone: "wait" };
  if (s === "yeni" && !lead.contactedAt)
    return { label: "İlk teması gönder", hint: "Mesaj hazır — aşağıdan WhatsApp veya e-posta ile ilk teması kur.", tone: "go" };
  if (s === "iletisim_kuruldu")
    return { label: "Yanıt bekle · gerekiyorsa takip et", hint: "İletişim kuruldu; birkaç gün içinde yanıt gelmezse nazik bir takip gönder.", tone: "warm" };
  if (s === "yanit_bekleniyor")
    return { label: "Takip mesajı gönder", hint: "Yanıt bekleniyor — kısa, değer katan bir hatırlatma zamanı.", tone: "warm" };
  if (s === "toplanti_planlandi")
    return { label: "Toplantıya hazırlan", hint: "Firmaya özel problemi + net çözümü + tahmini ROI'yi hazırla.", tone: "go" };
  if (s === "teklif_gonderildi")
    return { label: "Teklifi takip et", hint: "Teklif iletildi — karar sürecini yakından izle, itirazları önceden karşıla.", tone: "warm" };
  if (s === "muzakere")
    return { label: "Kapanışa götür", hint: "Müzakere aşaması — kalan itirazları gider ve anlaşmayı kapat.", tone: "go" };
  if (s === "takip")
    return { label: "Uygun zamanda yeniden dokun", hint: "Beklemede; takip zamanı gelince tekrar iletişime geç.", tone: "warm" };
  return { label: "İncele", hint: "", tone: "warm" };
}
