import { chromium, type Browser, type Page } from "playwright";
import type { RawCompany } from "../../core/types.js";
import { config } from "../../core/config.js";

/**
 * Google Maps uzerinden firma bulur. Minimum butce -> kendi scraper'imiz.
 *
 * NOT: Google Maps DOM'u sik degisir. Secililer savunmaci yazildi; bir alan
 * cikarilamazsa o alan bos kalir, tarama devam eder. Kirilirsa buradaki
 * secicileri guncellemek yeterli.
 */
export interface FindOptions {
  query: string; // ornek: "restoran Kadikoy Istanbul"
  maxResults?: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function findCompanies(opts: FindOptions): Promise<RawCompany[]> {
  const max = opts.maxResults ?? 20;
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const context = await browser.newContext({
      locale: "tr-TR",
      viewport: { width: 1280, height: 900 },
      userAgent: UA,
    });
    const page = await context.newPage();

    const url = `https://www.google.com/maps/search/${encodeURIComponent(opts.query)}?hl=tr`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    await dismissConsent(page);

    // Sonuc akisini bekle.
    const feedSel = 'div[role="feed"]';
    try {
      await page.waitForSelector(feedSel, { timeout: 20000 });
    } catch {
      // Tek sonuc dogrudan detay panelinde acilmis olabilir.
      const single = await scrapeSingleDetail(page);
      return single ? [single] : [];
    }

    const links = await collectResultLinks(page, feedSel, max);
    console.log(`  ${links.length} sonuc bulundu, detaylar cekiliyor...`);

    const results: RawCompany[] = [];
    for (const [i, link] of links.entries()) {
      try {
        const company = await scrapeDetail(page, link);
        if (company) {
          results.push(company);
          console.log(`  [${i + 1}/${links.length}] ${company.name}`);
        }
      } catch (err) {
        console.warn(`  [${i + 1}] detay cekilemedi: ${(err as Error).message}`);
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}

/**
 * ISME gore en iyi eslesen TEK yeri dondurur. Marka aramalarinda Maps ilk sirada
 * alakasiz bir yer donebiliyor; burada feed'deki adaylarin ISIMLERINI okuyup hedefe
 * en cok benzeyeni secer, SADECE onun detayini ceker (hizli + dogru). Eslesme zayifsa
 * null doner (cagiran yanlis firmayi atfetmez).
 */
export async function findBestPlace(opts: {
  query: string;
  targetName: string;
  max?: number;
}): Promise<RawCompany | null> {
  const max = opts.max ?? 8;
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const context = await browser.newContext({ locale: "tr-TR", viewport: { width: 1280, height: 900 }, userAgent: UA });
    const page = await context.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(opts.query)}?hl=tr`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissConsent(page);

    const feedSel = 'div[role="feed"]';
    let candidates: { name: string; href: string }[];
    try {
      await page.waitForSelector(feedSel, { timeout: 20000 });
      candidates = await collectResultCandidates(page, feedSel, max);
    } catch {
      // Tek sonuc dogrudan detayda acilmis olabilir; ismi hedefe uyuyorsa dondur.
      const single = await scrapeSingleDetail(page);
      return single && nameMatchScore(opts.targetName, single.name) >= 0.5 ? single : null;
    }

    let best: { name: string; href: string } | undefined;
    let bestScore = 0;
    for (const c of candidates) {
      const s = nameMatchScore(opts.targetName, c.name);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (!best || bestScore < 0.5) return null;
    return await scrapeDetail(page, best.href);
  } finally {
    await browser.close();
  }
}

/** Feed'deki sonuc adaylarini (isim + link) DETAY cekmeden toplar (aria-label = yer adi). */
async function collectResultCandidates(
  page: Page,
  feedSel: string,
  max: number,
): Promise<{ name: string; href: string }[]> {
  const byHref = new Map<string, string>(); // href -> name
  let stableRounds = 0;
  for (let round = 0; round < 30 && byHref.size < max; round++) {
    const items = await page.$$eval(`${feedSel} a[href*="/maps/place/"]`, (els) =>
      (els as HTMLAnchorElement[]).map((a) => ({ href: a.href, name: a.getAttribute("aria-label") || "" })),
    );
    const before = byHref.size;
    for (const it of items) if (it.href && !byHref.has(it.href)) byHref.set(it.href, it.name);
    if (byHref.size >= max) break;
    if (byHref.size === before) {
      stableRounds++;
      if (stableRounds >= 3) break;
    } else {
      stableRounds = 0;
    }
    await page.$eval(feedSel, (el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1000);
  }
  return [...byHref.entries()].slice(0, max).map(([href, name]) => ({ href, name }));
}

/**
 * Hedef isim ile aday isim benzerligi 0-1: hedef kelimelerinin kaci adayda geciyor.
 * "yemeksepeti" -> "Yemeksepeti Park" = 1.0 ; "getir" -> "Maydonoz Döner" = 0.
 */
export function nameMatchScore(target: string, candidate: string): number {
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/gi, " ").trim();
  const tokens = norm(target).split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return 0;
  const cand = norm(candidate);
  return tokens.filter((t) => cand.includes(t)).length / tokens.length;
}

async function dismissConsent(page: Page): Promise<void> {
  if (!/consent\.google|consent\.youtube/.test(page.url())) return;
  const labels = ["Tümünü kabul et", "Accept all", "Kabul et", "Tümünü reddet", "Reject all"];
  for (const label of labels) {
    const btn = page.getByRole("button", { name: label });
    if (await btn.count()) {
      await btn.first().click().catch(() => {});
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      return;
    }
  }
}

/** Sonuc akisini kaydirarak firma detay linklerini toplar. */
async function collectResultLinks(
  page: Page,
  feedSel: string,
  max: number,
): Promise<string[]> {
  const seen = new Set<string>();
  let stableRounds = 0;

  for (let round = 0; round < 30 && seen.size < max; round++) {
    const hrefs = await page.$$eval(`${feedSel} a[href*="/maps/place/"]`, (els) =>
      (els as HTMLAnchorElement[]).map((a) => a.href),
    );
    const before = seen.size;
    for (const h of hrefs) seen.add(h);

    if (seen.size >= max) break;
    if (seen.size === before) {
      stableRounds++;
      if (stableRounds >= 3) break; // daha fazla yuklenmiyor
    } else {
      stableRounds = 0;
    }
    // Akisi asagi kaydir.
    await page.$eval(feedSel, (el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1200);
  }

  return [...seen].slice(0, max);
}

async function scrapeDetail(page: Page, placeUrl: string): Promise<RawCompany | null> {
  await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
  return scrapeSingleDetail(page);
}

/** Acik olan detay panelinden alanlari cikarir. */
async function scrapeSingleDetail(page: Page): Promise<RawCompany | null> {
  const name = (await textOf(page, "h1")) ?? "";
  if (!name) return null;

  const website = await attrOf(page, 'a[data-item-id="authority"]', "href");
  const phone = await phoneOf(page);
  const category = await textOf(page, 'button[jsaction*="category"]');
  const address = await ariaValueOf(page, 'button[data-item-id="address"]');
  const { rating, reviewCount } = await ratingOf(page);

  return {
    name,
    category: category ?? undefined,
    address: address ?? undefined,
    city: guessCity(address),
    phone: phone ?? undefined,
    website: website ?? undefined,
    rating,
    reviewCount,
    mapsUrl: page.url(),
  };
}

async function textOf(page: Page, sel: string): Promise<string | null> {
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  const t = (await el.textContent())?.trim();
  return t || null;
}

async function attrOf(page: Page, sel: string, attr: string): Promise<string | null> {
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  return (await el.getAttribute(attr)) || null;
}

/** "Adres: ..." formatindaki aria-label'dan degeri ayiklar. */
async function ariaValueOf(page: Page, sel: string): Promise<string | null> {
  const label = await attrOf(page, sel, "aria-label");
  if (!label) return null;
  const idx = label.indexOf(":");
  return (idx >= 0 ? label.slice(idx + 1) : label).trim() || null;
}

async function phoneOf(page: Page): Promise<string | null> {
  const el = page.locator('button[data-item-id^="phone:tel:"]').first();
  if (await el.count()) {
    const id = await el.getAttribute("data-item-id");
    const tel = id?.replace("phone:tel:", "").trim();
    if (tel) return tel;
  }
  return null;
}

async function ratingOf(
  page: Page,
): Promise<{ rating?: number; reviewCount?: number }> {
  // Puan ve yorum sayisi ayri aria-label'larda olabilir; ikisini ayri ayri dene.
  let rating: number | undefined;
  let reviewCount: number | undefined;

  const rEl = page.locator('[aria-label*="yıldız"]').first();
  if (await rEl.count()) {
    const l = (await rEl.getAttribute("aria-label")) ?? "";
    const m = l.match(/([\d.,]+)\s*yıldız/);
    if (m) rating = parseFloat(m[1]!.replace(",", "."));
  }

  const cEl = page.locator('[aria-label*="yorum"]').first();
  if (await cEl.count()) {
    const l = (await cEl.getAttribute("aria-label")) ?? "";
    const m = l.match(/([\d.]+)\s*yorum/);
    if (m) reviewCount = parseInt(m[1]!.replace(/\./g, ""), 10);
  }

  return { rating, reviewCount };
}

function guessCity(address?: string | null): string | undefined {
  if (!address) return undefined;
  // TR adreslerinde sehir genelde son parcada: "..., Kadikoy/Istanbul, Turkiye"
  const parts = address.split(",").map((p) => p.trim());
  const cityPart = parts.reverse().find((p) => p.includes("/"));
  return cityPart?.split("/").pop()?.trim();
}
