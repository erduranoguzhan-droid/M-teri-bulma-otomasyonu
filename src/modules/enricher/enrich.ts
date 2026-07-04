import type { Enrichment, RawCompany } from "../../core/types.js";

const FETCH_TIMEOUT_MS = 10000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function enrichCompany(raw: RawCompany): Promise<Enrichment> {
  const empty = emptyEnrichment();
  if (!raw.website) return empty;

  const home = await fetchHtml(raw.website);
  if (!home) return empty;

  // Iletisim sayfasi da e-posta/sosyal icin degerli.
  const contactHtml = await fetchContactPage(raw.website, home);
  const html = home + "\n" + (contactHtml ?? "");

  return {
    websiteReachable: true,
    websiteTitle: extractTitle(home),
    emails: extractEmails(html),
    socials: extractSocials(html),
    tech: detectTech(html),
    pageTextSnippet: extractText(home).slice(0, 1500),
  };
}

function emptyEnrichment(): Enrichment {
  return {
    websiteReachable: false,
    emails: [],
    socials: {},
    tech: {
      hasGoogleAnalytics: false,
      hasMetaPixel: false,
      hasGoogleTagManager: false,
      hasWhatsApp: false,
      hasOnlineOrdering: false,
      hasReservation: false,
      hasLiveChat: false,
      hasBlog: false,
    },
  };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(normalizeUrl(url), {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchContactPage(baseUrl: string, homeHtml: string): Promise<string | null> {
  // Once anasayfadaki iletisim linkini dene; yoksa tek bir tahmin.
  // Yavas/olu sitelerde firma basina suryi patlatmamak icin en fazla 2 deneme.
  const linkMatch = homeHtml.match(/href=["']([^"']*(?:iletisim|contact|ulasin)[^"']*)["']/i);
  const urls: string[] = [];
  if (linkMatch?.[1]) urls.push(resolveUrl(baseUrl, linkMatch[1]));
  else urls.push(resolveUrl(baseUrl, "/iletisim"));

  for (const u of urls.slice(0, 2)) {
    const html = await fetchHtml(u);
    if (html) return html;
  }
  return null;
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const m of html.matchAll(re)) {
    const email = m[0].toLowerCase();
    // Gorsel/asset yanlis pozitiflerini ele.
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(email)) continue;
    if (/(sentry|example|wixpress|\.wixpress)/.test(email)) continue;
    found.add(email);
  }
  return [...found].slice(0, 5);
}

function extractSocials(html: string): Enrichment["socials"] {
  const grab = (re: RegExp): string | undefined => {
    const m = html.match(re);
    return m ? m[0] : undefined;
  };
  return {
    instagram: grab(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i),
    facebook: grab(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-]+/i),
    linkedin: grab(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.\-]+/i),
    whatsapp: grab(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s"'<>]+/i),
    youtube: grab(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)[A-Za-z0-9_.\-\/]+/i),
    twitter: grab(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i),
    tiktok: grab(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i),
  };
}

function detectTech(html: string): Enrichment["tech"] {
  const has = (re: RegExp) => re.test(html);
  let ecommercePlatform: string | undefined;
  if (has(/cdn\.shopify\.com|shopify/i)) ecommercePlatform = "shopify";
  else if (has(/wp-content\/plugins\/woocommerce|woocommerce/i)) ecommercePlatform = "woocommerce";
  else if (has(/ideasoft|ticimax|tsoft/i)) ecommercePlatform = "tr-ecommerce-platform";

  // Genel CMS / site kurucu tespiti (teknoloji olgunlugu sinyali).
  let platform: string | undefined;
  if (has(/wp-content|wp-includes|\/wp-json/i)) platform = "wordpress";
  else if (has(/static\.wixstatic\.com|_wix|wix\.com/i)) platform = "wix";
  else if (has(/static1\.squarespace|squarespace\.com/i)) platform = "squarespace";
  else if (has(/webflow\.io|assets\.website-files\.com/i)) platform = "webflow";
  else if (has(/ideasoft/i)) platform = "ideasoft";
  else if (has(/ticimax/i)) platform = "ticimax";
  else if (ecommercePlatform === "shopify") platform = "shopify";

  return {
    hasGoogleAnalytics: has(/google-analytics\.com|gtag\(|ga\('create'/i),
    hasGoogleTagManager: has(/googletagmanager\.com|GTM-[A-Z0-9]+/),
    hasMetaPixel: has(/connect\.facebook\.net|fbq\(/i),
    hasWhatsApp: has(/wa\.me\/|api\.whatsapp\.com|whatsapp/i),
    hasOnlineOrdering: has(/yemeksepeti|getir|migros|trendyol\s*yemek|online\s*sipari|sepete\s*ekle/i),
    hasReservation: has(/rezervasyon|opentable|reservation|masa\s*ayirt/i),
    hasLiveChat: has(/tawk\.to|intercom|crisp\.chat|zendesk|livechat|tidio/i),
    hasBlog: has(/\/blog|\/haberler|\/makale|<article[\s>]|"BlogPosting"/i),
    ecommercePlatform,
    platform,
    copyrightYear: detectCopyrightYear(html),
  };
}

/** Footer'daki telif yilini yakalar (© 2019 gibi) -> guncellik/ihmal sinyali. */
function detectCopyrightYear(html: string): number | undefined {
  const years: number[] = [];
  const re = /(?:©|&copy;|copyright)[^0-9]{0,20}(20[12][0-9])/gi;
  for (const m of html.matchAll(re)) {
    const y = Number(m[1]);
    if (y >= 2010 && y <= 2030) years.push(y);
  }
  return years.length ? Math.max(...years) : undefined;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) return "https://" + url;
  return url;
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, normalizeUrl(base)).toString();
  } catch {
    return normalizeUrl(base);
  }
}
