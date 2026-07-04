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

export async function findCompanies(opts: FindOptions): Promise<RawCompany[]> {
  const max = opts.maxResults ?? 20;
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const context = await browser.newContext({
      locale: "tr-TR",
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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
