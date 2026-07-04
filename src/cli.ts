import { createStore, type LeadStore } from "./core/storage.js";
import { runFind, runEnrich, runAnalyze, runOutreach, runPipeline } from "./pipeline.js";

/**
 * Basit CLI. Ornekler:
 *   npm run pipeline -- "kafe Kadikoy Istanbul" 15
 *   npm run find -- "restoran Cankaya Ankara" 20
 *   npm run enrich
 *   npm run analyze
 *   npm run outreach
 *   npm run list
 *   npm run list -- 1     (tek leadin detayini goster)
 */
async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const store = createStore();

  switch (cmd) {
    case "find": {
      const { query, max } = parseFindArgs(args);
      await runFind(store, query, max);
      break;
    }
    case "enrich":
      await runEnrich(store);
      break;
    case "analyze":
      await runAnalyze(store);
      break;
    case "outreach":
      await runOutreach(store);
      break;
    case "pipeline": {
      const { query, max } = parseFindArgs(args);
      await runPipeline(store, query, max);
      break;
    }
    case "list":
      await list(store, args[0]);
      break;
    default:
      printUsage();
      process.exit(cmd ? 1 : 0);
  }
}

function parseFindArgs(args: string[]): { query: string; max: number } {
  const maybeMax = Number(args[args.length - 1]);
  const hasMax = Number.isFinite(maybeMax) && args.length > 1;
  const query = (hasMax ? args.slice(0, -1) : args).join(" ").trim();
  if (!query) {
    console.error('Sorgu gerekli. Ornek: npm run pipeline -- "kafe Kadikoy Istanbul" 15');
    process.exit(1);
  }
  return { query, max: hasMax ? maybeMax : 15 };
}

async function list(store: LeadStore, idArg?: string): Promise<void> {
  const leads = await store.all();
  if (leads.length === 0) {
    console.log("Henuz lead yok. Once: npm run pipeline -- \"kafe Kadikoy Istanbul\" 15");
    return;
  }

  // Tek lead detayi: index (1-tabanli) veya id ile.
  if (idArg) {
    const idx = Number(idArg);
    const lead = Number.isFinite(idx) ? leads[idx - 1] : leads.find((l) => l.id === idArg);
    if (!lead) return console.log("Lead bulunamadi.");
    printDetail(lead, leads.indexOf(lead) + 1);
    return;
  }

  // Ozet tablo, lead score'a gore sirali.
  const sorted = [...leads].sort((a, b) => (b.analysis?.leadScore ?? 0) - (a.analysis?.leadScore ?? 0));
  console.log(`\nToplam ${leads.length} lead (score'a gore sirali):\n`);
  sorted.forEach((l) => {
    const i = leads.indexOf(l) + 1;
    const score = l.analysis ? String(l.analysis.leadScore).padStart(3) : "  -";
    const svc = l.analysis?.recommendedServices[0] ?? l.stage;
    console.log(`  #${String(i).padStart(3)} [${score}] ${l.raw.name}  —  ${svc}`);
  });
  console.log(`\nDetay icin: npm run list -- <numara>`);
}

function printDetail(lead: import("./core/types.js").Lead, index: number): void {
  const { raw, analysis, outreach, enrichment } = lead;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`#${index}  ${raw.name}   [${lead.crmStatus}]`);
  console.log("=".repeat(60));
  console.log(`Kategori : ${raw.category ?? "-"}`);
  console.log(`Sehir    : ${raw.city ?? "-"}`);
  console.log(`Telefon  : ${raw.phone ?? "-"}`);
  console.log(`Website  : ${raw.website ?? "yok"}`);
  console.log(`Google   : ${raw.rating ?? "-"} (${raw.reviewCount ?? 0} yorum)`);
  if (enrichment?.emails.length) console.log(`E-posta  : ${enrichment.emails.join(", ")}`);

  if (analysis) {
    console.log(`\n-- ANALIZ --`);
    console.log(`Lead Score : ${analysis.leadScore}   ICP: ${analysis.icpScore}   Aciliyet: ${analysis.urgencyScore}   Butce: ${analysis.budgetLevel}`);
    console.log(`Problem    : ${analysis.biggestProblem}`);
    console.log(`Firsat     : ${analysis.easiestAutomation}`);
    console.log(`Hizmetler  : ${analysis.recommendedServices.join(", ")}`);
    console.log(`ROI Pitch  : ${analysis.bestRoiPitch}`);
  }

  if (outreach) {
    console.log(`\n-- WHATSAPP --\n${outreach.whatsapp}`);
    console.log(`\n-- E-POSTA --\nKonu: ${outreach.email.subject}\n\n${outreach.email.body}`);
  }
  console.log();
}

function printUsage(): void {
  console.log(`Vertex Lead Gen — cekirdek dongu CLI

Komutlar:
  npm run pipeline -- "<sorgu>" [adet]   Tum dongu (bul→zenginlestir→analiz→teklif)
  npm run find     -- "<sorgu>" [adet]   Sadece firma bul
  npm run enrich                          Bulunan firmalari zenginlestir
  npm run analyze                         Zenginlestirilmisleri analiz et
  npm run outreach                        Analiz edilmislere mesaj uret
  npm run list                            Leadleri listele (score sirali)
  npm run list     -- <numara>            Tek leadin detayi

Ornek:
  npm run pipeline -- "kafe Kadikoy Istanbul" 15`);
}

main().catch((err) => {
  console.error("\nHATA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
