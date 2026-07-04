/**
 * Mevcut leadleri YENIDEN SKORLAR — LLM cagrisi YOK, tamamen deterministik/yerel.
 * Skorlama kurallari degisince ( or. sektore duyarli v2) tum leadlere Max/API
 * harcamadan uygular. Sadece analizi olan leadleri gunceller.
 */
import { createStore } from "./core/storage.js";
import { computeScores } from "./core/scoring.js";
import { sectorFor } from "./core/services.js";

async function main() {
  const store = createStore();
  const leads = await store.all();
  const scored = leads.filter((l) => l.analysis);
  console.log(`\n${scored.length} lead yeniden skorlaniyor (sektore duyarli, LLM'siz)...\n`);

  let changed = 0;
  for (const lead of scored) {
    const a = lead.analysis!;
    const before = a.leadScore;
    const sec = sectorFor(lead.raw);
    const s = computeScores(lead.raw, lead.enrichment, a.budgetLevel, sec);
    a.leadScore = s.leadScore;
    a.icpScore = s.icpScore;
    a.urgencyScore = s.urgencyScore;
    await store.save(lead);
    const delta = s.leadScore - before;
    if (delta !== 0) changed++;
    const arrow = delta > 0 ? `+${delta}` : `${delta}`;
    console.log(
      `  ${String(before).padStart(3)} -> ${String(s.leadScore).padStart(3)} (${arrow.padStart(4)}) [${sec.padEnd(18)}] ${lead.raw.name}`,
    );
  }
  console.log(`\nBitti: ${scored.length} lead islendi, ${changed} tanesinin skoru degisti.`);
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
