import "dotenv/config";

// LLM backend secimi:
//  "cli" -> Claude Code CLI (claude -p), Max aboneliginden calisir, API kredisi harcamaz
//  "api" -> Anthropic API (ANTHROPIC_API_KEY), otomatik/olcekli calisma icin
export type LlmBackend = "cli" | "api";

// Depolama: "json" (yerel dosya) veya "supabase" (kalici DB).
export type StorageBackend = "json" | "supabase";

const llmBackend = (process.env.LLM_BACKEND ?? "cli") as LlmBackend;

// LLM eszamanlilik varsayilani backend'e gore:
//  - api: Haiku, rate-limit yok -> yuksek paralellik (6)
//  - cli: Max aboneligi toplu cagride rate-limit'e girer -> seri (1), retry/backoff'a yaslan
const defaultLlmConcurrency = llmBackend === "api" ? 6 : 1;

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export const config = {
  llmBackend,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // API backend modeli (ucuz + hizli)
  analyzerModel: process.env.ANALYZER_MODEL ?? "claude-haiku-4-5",
  // CLI backend modeli (Max'te bedava; sonnet iyi denge)
  cliModel: process.env.CLI_MODEL ?? "sonnet",
  headless: (process.env.HEADLESS ?? "true") !== "false",
  // Eszamanlilik / dayaniklilik (toplu/olcek islemleri icin)
  llmConcurrency: intEnv("LLM_CONCURRENCY", defaultLlmConcurrency),
  enrichConcurrency: intEnv("ENRICH_CONCURRENCY", 4), // website tarama = ag I/O, backend'den bagimsiz
  llmRetries: intEnv("LLM_RETRIES", 3), // gecici hata (rate-limit/timeout/bozuk JSON) icin
  competitorMax: intEnv("COMPETITOR_MAX", 4), // rakip analizinde firma-basi ust sinir
  // Depolama
  storageBackend: (process.env.STORAGE_BACKEND ?? "json") as StorageBackend,
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
} as const;

export function requireSupabase(): { url: string; key: string } {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_SERVICE_KEY gerekli (.env). STORAGE_BACKEND=supabase kullaniyorsun.",
    );
  }
  return { url: config.supabaseUrl, key: config.supabaseServiceKey };
}

export function requireAnthropicKey(): string {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY tanimli degil. .env dosyasina ekle (bkz. .env.example).",
    );
  }
  return config.anthropicApiKey;
}
