// wa.me ve mailto link ureticileri (saf; client'ta da kullanilir).

/** TR telefonu uluslararasi formata cevirir: 0530... -> 90530..., +90.. -> 90.. */
export function normalizePhoneTR(phone: string | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("90")) return d;
  if (d.startsWith("0")) return "90" + d.slice(1);
  if (d.length === 10 && d.startsWith("5")) return "90" + d; // 5xxxxxxxxx
  return d || null;
}

export function waLink(phone: string | undefined, text: string): string | null {
  const p = normalizePhoneTR(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(email: string | undefined, subject: string, body: string): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** ISO tarihi kisa TR formatinda ("3 Tem" gibi). */
export function shortDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
