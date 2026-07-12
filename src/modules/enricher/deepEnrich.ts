// Firma-bazli DERIN enrichment. Mevcut enrich.ts'i BOZMAZ (ayri modul).
// Cok-sayfa kesif + zengin teknoloji stack + DNS/e-posta altyapisi + site-turevli
// karar verici & guncel sinyal. Ilke: yalniz SITE'den ve guvenli kaynaklardan; uydurma yok.

import { resolveMx, resolveTxt } from "node:dns/promises";
import type { Enrichment, RawCompany } from "../../core/types.js";
import type { DecisionMaker, EmailDns, NewsSignal, TechStack } from "../../core/intelligence.js";

const FETCH_TIMEOUT_MS = 12000;
const MAX_PAGES = 8;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface DeepEnrichResult {
  enrichment: Enrichment;
  technologies: TechStack;
  contacts: DecisionMaker[];
  signals: NewsSignal[];
  /** AI'ye baglam olarak verilecek sayfa metinleri (etiketli). */
  pageTexts: { label: string; url: string; text: string }[];
  sources: string[];
}

/** Kesfedilecek sayfa turleri + link eslesme kaliplari (TR + EN). */
const PAGE_PATTERNS: [label: string, re: RegExp][] = [
  ["about", /(hakkimizda|hakkinda|about|kurumsal|biz-kimiz)/i],
  ["contact", /(iletisim|contact|ulasin|bize-ulasin)/i],
  ["team", /(ekip|team|kadro|yonetim|takim|people)/i],
  ["careers", /(kariyer|career|jobs|is-ilan|acik-pozisyon|join-us|is-basvuru)/i],
  ["services", /(hizmet|services|cozum|solutions|ne-yapiyoruz)/i],
  ["products", /(urun|product|magaza|shop|katalog)/i],
  ["blog", /(blog|haberler|makale|news|basin|press|insights)/i],
  ["case", /(case-stud|referans|basari-hikaye|musteri|portfoy|projeler)/i],
];

export async function deepEnrichCompany(raw: RawCompany): Promise<DeepEnrichResult> {
  const emptyTech = emptyTechStack();
  const base = emptyEnrichment();

  const target = raw.website;
  if (!target) {
    // Site yoksa domain de yok -> DNS/enrichment yapilamaz.
    return { enrichment: base, technologies: emptyTech, contacts: [], signals: [], pageTexts: [], sources: [] };
  }

  const homeUrl = normalizeUrl(target);
  const sources: string[] = [];

  // 0) DNS/e-posta altyapisi: HTTP'DEN BAGIMSIZ. Site bot-korumasi HTTP'yi engellese
  //    bile MX/SPF/DMARC cozulur (gercek, degerli sinyal).
  const emailDns = await detectEmailDns(homeUrl);

  // 1) Homepage cek: once hizli fetch; bot-korumali (Cloudflare vb.) sitelerde
  //    Playwright'a (gercek tarayici) dus.
  let fetchPage: (url: string) => Promise<string | null> = fetchHtml;
  let closeBrowser: (() => Promise<void>) | undefined;
  let home = await fetchHtml(homeUrl);
  if (!home) {
    const pw = await makePwFetcher();
    if (pw) {
      fetchPage = pw.fetch;
      closeBrowser = pw.close;
      home = await pw.fetch(homeUrl);
    }
  }

  if (!home) {
    if (closeBrowser) await closeBrowser();
    // HTML yok ama DNS var -> emailDns'i dondur (AI genel bilgiyle calisir, uydurmaz).
    const tech = emptyTechStack();
    tech.emailDns = emailDns;
    return { enrichment: base, technologies: tech, contacts: [], signals: [], pageTexts: [], sources: [homeUrl] };
  }
  sources.push(homeUrl);
  emailDns.ssl = /^https:\/\//i.test(homeUrl); // https ile HTML alindi = gecerli SSL

  // 2) Sayfa kesfi: anasayfadaki ic linklerden ture gore en iyi adaylari sec.
  const discovered = discoverPages(homeUrl, home);
  const pages: { label: string; url: string; html: string }[] = [{ label: "home", url: homeUrl, html: home }];
  for (const { label, url } of discovered) {
    if (pages.length >= MAX_PAGES) break;
    if (pages.some((p) => p.url === url)) continue;
    const html = await fetchPage(url); // homepage'de calisan yontemle (fetch veya Playwright)
    if (html) {
      pages.push({ label, url, html });
      sources.push(url);
    }
  }
  if (closeBrowser) await closeBrowser();

  const allHtml = pages.map((p) => p.html).join("\n");
  const byLabel = (l: string) => pages.find((p) => p.label === l);

  // 2) Iletisim
  const emails = extractEmails(allHtml);
  const enrichment: Enrichment = {
    websiteReachable: true,
    websiteTitle: extractTitle(home),
    emails,
    socials: extractSocials(allHtml),
    tech: detectBasicTech(allHtml),
    pageTextSnippet: extractText(home).slice(0, 1500),
    generalEmail: pickEmail(emails, ["info", "hello", "contact", "iletisim"]) ?? emails[0],
    salesEmail: pickEmail(emails, ["sales", "satis", "bd", "business"]),
    supportEmail: pickEmail(emails, ["support", "destek", "help", "yardim"]),
    contactFormUrl: byLabel("contact")?.url ?? findFormUrl(homeUrl, home),
    pagesCrawled: pages.map((p) => p.url),
  };

  // 3) Teknoloji stack + (yukarida cozulen) DNS
  const technologies = detectTechStack(allHtml, pages);
  technologies.emailDns = emailDns;

  // 4) Karar vericiler (site-turevli: LinkedIn /in/ profilleri + isim-benzeri e-postalar)
  const contacts = extractContacts(pages);

  // 5) Guncel sinyaller (site-turevli: kariyer/blog/haber)
  const signals = extractSignals(pages);

  const pageTexts = pages.map((p) => ({ label: p.label, url: p.url, text: extractText(p.html).slice(0, 2500) }));

  return { enrichment, technologies, contacts, signals, pageTexts, sources };
}

// ---------------------------------------------------------------------------
// Sayfa kesfi
// ---------------------------------------------------------------------------
function discoverPages(baseUrl: string, homeHtml: string): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  const hrefRe = /href=["']([^"'#]+)["']/gi;
  const hrefs: string[] = [];
  for (const m of homeHtml.matchAll(hrefRe)) if (m[1]) hrefs.push(m[1]);

  for (const [label, re] of PAGE_PATTERNS) {
    // Bu tur icin ilk eslesen ic linki al.
    const hit = hrefs.find((h) => re.test(h) && !/\.(pdf|jpg|png|zip|mp4)$/i.test(h));
    if (!hit) continue;
    const url = resolveUrl(baseUrl, hit);
    if (!sameHost(baseUrl, url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label, url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Teknoloji stack tespiti (imza tabanli; sadece gercekten gorulen = tespit)
// ---------------------------------------------------------------------------
function detectTechStack(html: string, pages: { html: string }[]): TechStack {
  const h = html;
  const has = (re: RegExp) => re.test(h);
  const collect = (defs: [string, RegExp][]): string[] =>
    defs.filter(([, re]) => re.test(h)).map(([name]) => name);

  const cms = collect([
    ["WordPress", /wp-content|wp-includes|\/wp-json/i],
    ["Webflow", /webflow\.io|assets\.website-files\.com|wf-/i],
    ["Shopify", /cdn\.shopify\.com|myshopify\.com/i],
    ["WooCommerce", /woocommerce/i],
    ["Framer", /framer\.com|framerusercontent/i],
    ["Wix", /static\.wixstatic\.com|_wix|wix\.com/i],
    ["Squarespace", /squarespace\.com|static1\.squarespace/i],
  ]);
  const frontend = collect([
    ["Next.js", /_next\/static|__NEXT_DATA__|\/_next\//i],
    ["React", /react(?:-dom)?(?:\.production)?\.min\.js|data-reactroot|__REACT/i],
    ["Nuxt", /__nuxt|_nuxt\//i],
    ["Vue", /vue(?:\.runtime)?(?:\.min)?\.js|data-v-[0-9a-f]{8}/i],
    ["Angular", /ng-version=|angular(?:\.min)?\.js/i],
  ]);
  const analytics = collect([
    ["Google Analytics", /google-analytics\.com|gtag\(|G-[A-Z0-9]{8,}|UA-\d{4,}/],
    ["Google Tag Manager", /googletagmanager\.com|GTM-[A-Z0-9]+/],
    ["Meta Pixel", /connect\.facebook\.net|fbq\(/i],
    ["TikTok Pixel", /analytics\.tiktok\.com|ttq\./i],
    ["LinkedIn Insight", /snap\.licdn\.com|_linkedin_partner_id/i],
    ["Hotjar", /static\.hotjar\.com|hjSetting/i],
    ["Microsoft Clarity", /clarity\.ms/i],
  ]);
  const crmMarketing = collect([
    ["HubSpot", /js\.hs-scripts\.com|hubspot/i],
    ["Salesforce", /salesforce\.com|pardot/i],
    ["Intercom", /widget\.intercom\.io|intercomcdn/i],
    ["Zendesk", /zendesk|zdassets/i],
    ["Drift", /drift\.com|driftt/i],
    ["Mailchimp", /mailchimp|list-manage\.com|mc\.us\d+/i],
    ["Klaviyo", /klaviyo/i],
    ["ActiveCampaign", /activehosted|activecampaign/i],
  ]);
  const infrastructure = collect([
    ["Cloudflare", /cloudflare|cdnjs\.cloudflare\.com|__cf/i],
    ["AWS", /amazonaws\.com|cloudfront\.net/i],
    ["Vercel", /vercel\.app|_vercel/i],
    ["Netlify", /netlify\.app|netlify\.com/i],
    ["Firebase", /firebaseio\.com|firebaseapp\.com/i],
    ["Supabase", /supabase\.co|supabase\.in/i],
  ]);
  const ecommerce = collect([
    ["Shopify", /cdn\.shopify\.com|myshopify\.com/i],
    ["WooCommerce", /woocommerce/i],
    ["Magento", /magento|mage\//i],
    ["BigCommerce", /bigcommerce/i],
  ]);
  void has, void pages;

  return { cms, frontend, analytics, crmMarketing, infrastructure, ecommerce, emailDns: emptyDns() };
}

// ---------------------------------------------------------------------------
// DNS / e-posta altyapisi (Node yerlesik dns/promises; harici paket yok)
// ---------------------------------------------------------------------------
async function detectEmailDns(siteUrl: string): Promise<EmailDns> {
  const dns = emptyDns();
  let domain: string;
  try {
    domain = new URL(normalizeUrl(siteUrl)).hostname.replace(/^www\./, "");
  } catch {
    return dns;
  }

  try {
    const mx = await resolveMx(domain);
    dns.mxRecords = mx.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase());
    dns.mailProvider = detectMailProvider(dns.mxRecords);
  } catch {
    dns.mxRecords = [];
  }

  try {
    const txt = (await resolveTxt(domain)).map((r) => r.join("").toLowerCase());
    dns.spf = txt.some((t) => t.includes("v=spf1"));
    dns.dmarc = await hasDmarc(domain);
  } catch {
    dns.spf = null;
  }
  return dns;
}

/** Bot-korumali siteler icin Playwright tabanli fetcher (gercek tarayici). Lazy import. */
async function makePwFetcher(): Promise<
  { fetch: (url: string) => Promise<string | null>; close: () => Promise<void> } | null
> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "tr-TR",
      userAgent: UA,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const fetchOne = async (url: string): Promise<string | null> => {
      try {
        await page.goto(normalizeUrl(url), { waitUntil: "domcontentloaded", timeout: FETCH_TIMEOUT_MS });
        return await page.content();
      } catch {
        return null;
      }
    };
    return { fetch: fetchOne, close: () => browser.close() };
  } catch {
    return null; // Playwright yoksa/baslatilamazsa sessizce plain-fetch ile devam.
  }
}

async function hasDmarc(domain: string): Promise<boolean | null> {
  try {
    const txt = (await resolveTxt(`_dmarc.${domain}`)).map((r) => r.join("").toLowerCase());
    return txt.some((t) => t.includes("v=dmarc1"));
  } catch {
    return null;
  }
}

function detectMailProvider(mx: string[]): string | null {
  const j = mx.join(" ");
  if (/google|googlemail|aspmx/.test(j)) return "Google Workspace";
  if (/outlook|microsoft|office365|protection\.outlook/.test(j)) return "Microsoft 365";
  if (/yandex/.test(j)) return "Yandex";
  if (/zoho/.test(j)) return "Zoho";
  if (/messagelabs|symantec|broadcom/.test(j)) return "Symantec/MessageLabs (kurumsal)";
  if (/mimecast/.test(j)) return "Mimecast (kurumsal)";
  if (/proofpoint|pphosted/.test(j)) return "Proofpoint (kurumsal)";
  if (/barracuda/.test(j)) return "Barracuda (kurumsal)";
  if (/amazonaws|amazonses/.test(j)) return "Amazon SES";
  if (/mailgun|sendgrid|mandrill/.test(j)) return "ESP (Mailgun/SendGrid)";
  if (/yildiz|natro|turhost|guzel|hosting\.com\.tr/.test(j)) return "TR Hosting";
  return mx.length ? "Diğer" : null;
}

// ---------------------------------------------------------------------------
// Karar verici cikarimi (site-turevli, guvenli; UYDURMA YOK)
// ---------------------------------------------------------------------------
function extractContacts(pages: { label: string; url: string; html: string }[]): DecisionMaker[] {
  const contacts: DecisionMaker[] = [];
  const seen = new Set<string>();
  const teamPages = pages.filter((p) => p.label === "team" || p.label === "about" || p.label === "contact");
  const scope = (teamPages.length ? teamPages : pages).map((p) => ({ url: p.url, html: p.html }));

  for (const { url, html } of scope) {
    // Kisisel LinkedIn profilleri (gercek URL -> uydurma degil).
    const re = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/gi;
    for (const m of html.matchAll(re)) {
      const link = m[0];
      const slug = m[1] ?? "";
      const key = link.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        name: slugToName(slug),
        title: null,
        linkedin: link,
        twitter: null,
        email: null,
        sourceUrl: url,
        confidence: 55, // site'den gercek profil linki; isim slug'dan tureti -> orta guven
      });
      if (contacts.length >= 12) break;
    }
    if (contacts.length >= 12) break;
  }
  return contacts;
}

function slugToName(slug: string): string {
  const clean = slug.replace(/[-_]+\d+$/, "").replace(/[-_]+/g, " ").trim();
  if (!clean) return "unknown";
  return clean
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Guncel sinyal cikarimi (site-turevli)
// ---------------------------------------------------------------------------
function extractSignals(pages: { label: string; url: string; html: string }[]): NewsSignal[] {
  const signals: NewsSignal[] = [];
  const careers = pages.find((p) => p.label === "careers");
  if (careers) {
    const text = extractText(careers.html);
    const positions = matchPositions(text);
    signals.push({
      title: positions.length ? `Aktif ise alim (${positions.length}+ pozisyon)` : "Kariyer sayfasi aktif",
      date: null,
      source: careers.url,
      summary: positions.length ? positions.slice(0, 5).join(", ") : "Firmanin acik kariyer/ise alim sayfasi mevcut.",
      salesMeaning: "Ekip buyumesi/olceklenme sinyali — otomasyon ihtiyaci artar, outreach zamanlamasi iyi.",
    });
  }

  const blog = pages.find((p) => p.label === "blog");
  if (blog) {
    const recentYear = latestYear(blog.html);
    const active = recentYear != null && recentYear >= new Date().getFullYear() - 1;
    signals.push({
      title: active ? "Aktif icerik uretimi" : "Blog/haber sayfasi mevcut",
      date: recentYear ? String(recentYear) : null,
      source: blog.url,
      summary: active ? "Yakin tarihli icerikler var — pazarlamaya yatirim yapiyor." : "Blog var ama guncellik dusuk olabilir.",
      salesMeaning: active
        ? "Pazarlamaya deger veriyor — icerik/otomasyon hizmetlerine acik."
        : "Icerik uretimi zayif — Icerik Uretim Agent firsati.",
    });
  }
  return signals;
}

function matchPositions(text: string): string[] {
  const roles = /(mühendis|engineer|developer|gelistirici|uzman|specialist|müdür|manager|analist|analyst|designer|tasarimci|satis|sales|pazarlama|marketing|stajyer|intern)/gi;
  const found = new Set<string>();
  for (const m of text.matchAll(roles)) found.add(m[0].toLowerCase());
  return [...found];
}

function latestYear(html: string): number | undefined {
  const years: number[] = [];
  for (const m of html.matchAll(/20[12][0-9]/g)) {
    const y = Number(m[0]);
    if (y >= 2015 && y <= new Date().getFullYear() + 1) years.push(y);
  }
  return years.length ? Math.max(...years) : undefined;
}

// ---------------------------------------------------------------------------
// Ortak HTML yardimcilari (deepEnrich icin bagimsiz; enrich.ts'e dokunmaz)
// ---------------------------------------------------------------------------
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(normalizeUrl(url), {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8" },
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

function detectBasicTech(html: string): Enrichment["tech"] {
  const has = (re: RegExp) => re.test(html);
  let ecommercePlatform: string | undefined;
  if (has(/cdn\.shopify\.com|myshopify/i)) ecommercePlatform = "shopify";
  else if (has(/woocommerce/i)) ecommercePlatform = "woocommerce";
  let platform: string | undefined;
  if (has(/wp-content|wp-json/i)) platform = "wordpress";
  else if (has(/wixstatic|_wix/i)) platform = "wix";
  else if (has(/webflow|website-files/i)) platform = "webflow";
  else if (has(/framerusercontent/i)) platform = "framer";
  return {
    hasGoogleAnalytics: has(/google-analytics\.com|gtag\(|G-[A-Z0-9]{8,}/),
    hasGoogleTagManager: has(/googletagmanager\.com|GTM-[A-Z0-9]+/),
    hasMetaPixel: has(/connect\.facebook\.net|fbq\(/i),
    hasWhatsApp: has(/wa\.me\/|api\.whatsapp\.com|whatsapp/i),
    hasOnlineOrdering: has(/yemeksepeti|getir|trendyol\s*yemek|sepete\s*ekle|add\s*to\s*cart/i),
    hasReservation: has(/rezervasyon|reservation|book\s*now|randevu/i),
    hasLiveChat: has(/tawk\.to|intercom|crisp\.chat|zendesk|livechat|tidio|drift/i),
    hasBlog: has(/\/blog|\/haberler|\/makale|<article[\s>]|"BlogPosting"/i),
    ecommercePlatform,
    platform,
    copyrightYear: detectCopyrightYear(html),
  };
}

function detectCopyrightYear(html: string): number | undefined {
  const years: number[] = [];
  for (const m of html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(20[12][0-9])/gi)) {
    const y = Number(m[1]);
    if (y >= 2010 && y <= 2030) years.push(y);
  }
  return years.length ? Math.max(...years) : undefined;
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    const email = m[0].toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(email)) continue;
    if (/(sentry|example|wixpress|\.wixpress|schema\.org)/.test(email)) continue;
    found.add(email);
  }
  return [...found].slice(0, 10);
}

function pickEmail(emails: string[], keys: string[]): string | undefined {
  return emails.find((e) => keys.some((k) => e.startsWith(`${k}@`) || e.includes(`${k}@`)));
}

function findFormUrl(base: string, html: string): string | undefined {
  const m = html.match(/href=["']([^"'#]*(?:iletisim|contact|ulasin)[^"']*)["']/i);
  return m?.[1] ? resolveUrl(base, m[1]) : undefined;
}

function extractSocials(html: string): Enrichment["socials"] {
  const grab = (re: RegExp): string | undefined => html.match(re)?.[0];
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

function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
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
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, normalizeUrl(base)).toString();
  } catch {
    return normalizeUrl(base);
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(normalizeUrl(a)).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function emptyEnrichment(): Enrichment {
  return {
    websiteReachable: false,
    emails: [],
    socials: {},
    tech: {
      hasGoogleAnalytics: false, hasMetaPixel: false, hasGoogleTagManager: false,
      hasWhatsApp: false, hasOnlineOrdering: false, hasReservation: false,
      hasLiveChat: false, hasBlog: false,
    },
  };
}

function emptyTechStack(): TechStack {
  return { cms: [], frontend: [], analytics: [], crmMarketing: [], infrastructure: [], ecommerce: [], emailDns: emptyDns() };
}

function emptyDns(): EmailDns {
  return { mxRecords: [], mailProvider: null, spf: null, dkim: null, dmarc: null, ssl: null };
}
