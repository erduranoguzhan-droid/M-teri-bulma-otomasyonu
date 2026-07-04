import { createStore } from "./core/storage.js";
import { writeScanStatus, type ScanStatus } from "./core/scanStatus.js";
import { runFind, runEnrich, runAnalyze, runOutreach } from "./pipeline.js";

/**
 * Coklu-sorgu tarama. Ilce x kategori kombinasyonlarini sorgulara cevirir,
 * hepsini bulur, sonra topluca zenginlestirir/analiz eder/mesaj uretir.
 * Ilerlemeyi data/scan-status.json'a yazar (dashboard bunu okur).
 *
 * Ornek:
 *   npm run scan -- --city "İstanbul" --districts "Kadıköy,Beşiktaş" --categories "kafe,restoran" --max 15
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const queries = buildQueries(args);
  if (queries.length === 0) {
    console.error('Sorgu uretilemedi. Ornek: npm run scan -- --city "İstanbul" --districts "Kadıköy" --categories "kafe" --max 15');
    process.exit(1);
  }

  const store = createStore();
  const status: ScanStatus = {
    running: true,
    phase: "find",
    startedAt: new Date().toISOString(),
    queries,
    queryIndex: 0,
    queryTotal: queries.length,
    found: 0,
  };
  await writeScanStatus(status);
  console.log(`\n[SCAN] ${queries.length} sorgu, max ${args.max}/sorgu:\n  ${queries.join("\n  ")}`);

  try {
    // BUL: her sorgu icin
    for (let i = 0; i < queries.length; i++) {
      status.queryIndex = i;
      status.message = queries[i];
      await writeScanStatus(status);
      const leads = await runFind(store, queries[i]!, args.max);
      status.found += leads.length;
      await writeScanStatus(status);
    }

    // ZENGINLESTIR / ANALIZ / TEKLIF (toplu)
    await setPhase(status, "enrich");
    await runEnrich(store);
    await setPhase(status, "analyze");
    await runAnalyze(store);
    await setPhase(status, "outreach");
    await runOutreach(store);

    status.running = false;
    status.phase = "done";
    status.finishedAt = new Date().toISOString();
    status.message = `${status.found} firma tarandi.`;
    await writeScanStatus(status);
    console.log(`\n[SCAN] Bitti. ${status.found} firma.`);
  } catch (err) {
    status.running = false;
    status.phase = "error";
    status.finishedAt = new Date().toISOString();
    status.message = (err as Error).message;
    await writeScanStatus(status);
    console.error("[SCAN] HATA:", (err as Error).message);
    process.exit(1);
  }
}

async function setPhase(status: ScanStatus, phase: ScanStatus["phase"]): Promise<void> {
  status.phase = phase;
  status.message = undefined;
  await writeScanStatus(status);
}

interface ScanArgs {
  city: string;
  districts: string[];
  categories: string[];
  max: number;
}

function parseArgs(argv: string[]): ScanArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const split = (v: string | undefined): string[] =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    city: (get("--city") ?? "").trim(),
    districts: split(get("--districts")),
    categories: split(get("--categories")),
    max: Number(get("--max")) || 15,
  };
}

/** Kategori x ilce -> "kafe Kadıköy İstanbul" tarzi sorgular. */
function buildQueries(a: ScanArgs): string[] {
  const cats = a.categories.length ? a.categories : ["restoran"];
  const dists = a.districts.length ? a.districts : [""];
  const out: string[] = [];
  for (const d of dists) {
    for (const c of cats) {
      out.push([c, d, a.city].filter(Boolean).join(" ").trim());
    }
  }
  return [...new Set(out)];
}

main().catch((err) => {
  console.error("\nHATA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
