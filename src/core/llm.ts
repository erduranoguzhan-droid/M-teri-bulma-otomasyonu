import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { config, requireAnthropicKey } from "./config.js";

export interface LlmJsonOpts<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/**
 * LLM'den yapilandirilmis JSON alir. Backend'e gore yonlendirir:
 *  - "api": Anthropic messages.parse (garantili sema, API kredisi)
 *  - "cli": claude -p (Max aboneligi, bedava; JSON'u prompt'la zorlariz)
 */
export async function llmJson<T>(opts: LlmJsonOpts<T>): Promise<T> {
  const run = () => (config.llmBackend === "cli" ? llmJsonCli(opts) : llmJsonApi(opts));
  // Gecici hatalarda (Max rate-limit, timeout, bozuk JSON) ustel backoff ile yeniden dene.
  const retries = Math.max(0, config.llmRetries);
  let firstErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt === 0) firstErr = err;
      if (attempt === retries) break;
      // 3s, 6s, 12s ... + jitter; rate-limit sinyali varsa daha uzun bekle.
      const base = isRateLimit(err) ? 8000 : 3000;
      const wait = base * 2 ** attempt + Math.floor(Math.random() * 1000);
      await sleep(wait);
    }
  }
  throw firstErr;
}

function isRateLimit(err: unknown): boolean {
  const m = (err as Error)?.message?.toLowerCase() ?? "";
  return m.includes("rate") || m.includes("429") || m.includes("limit") || m.includes("overloaded");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- API backend ---
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireAnthropicKey() });
  return client;
}

async function llmJsonApi<T>({ system, user, schema, maxTokens }: LlmJsonOpts<T>): Promise<T> {
  const res = await getClient().messages.parse({
    model: config.analyzerModel,
    max_tokens: maxTokens ?? 1500,
    system,
    messages: [{ role: "user", content: user }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output_config: { format: zodOutputFormat(schema as any) },
  });
  if (!res.parsed_output) {
    throw new Error(`API: JSON ayristirilamadi (stop_reason: ${res.stop_reason})`);
  }
  return res.parsed_output as T;
}

// --- CLI backend (Claude Code / Max) ---
async function llmJsonCli<T>({ system, user, schema }: LlmJsonOpts<T>): Promise<T> {
  const prompt = [
    system,
    "",
    "=== GIRDI ===",
    user,
    "",
    "=== CIKTI KURALI ===",
    "Yanitin SADECE gecerli tek bir JSON nesnesi olsun.",
    "Markdown, kod blogu (```), aciklama veya on/arka metin YOK.",
  ].join("\n");

  const raw = await runClaudeCli(prompt);
  await sleep(600); // Max'i toplu cagride yormamak icin hafif pace
  const jsonText = extractJson(raw);
  try {
    return schema.parse(JSON.parse(jsonText));
  } catch (err) {
    throw new Error(`CLI: JSON ayristirilamadi (${(err as Error).message}). Ham cikti basi: ${raw.slice(0, 200)}`);
  }
}

/** claude -p cagirir, prompt'u stdin'den verir, --output-format json sarmalayicisindan result'i ceker. */
function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Windows'ta "claude" bir .cmd shim; shell:true ile calistiriyoruz.
    const child = spawn("claude", ["-p", "--output-format", "json", "--model", config.cliModel], {
      shell: true,
      windowsHide: true,
    });

    let out = "";
    let errOut = "";
    const killer = setTimeout(() => child.kill(), 150000);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (errOut += d.toString()));
    child.on("error", (e) => {
      clearTimeout(killer);
      reject(new Error(`claude CLI baslatilamadi: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        // Max rate-limit/usage tavani genelde stdout'a (JSON wrapper) yazar; ikisini de raporla.
        const detail = (errOut || out || "(cikti yok)").slice(0, 300);
        return reject(new Error(`claude CLI cikis kodu ${code}: ${detail}`));
      }
      try {
        const wrap = JSON.parse(out);
        resolve(String(wrap.result ?? ""));
      } catch {
        resolve(out); // sarmalayici degilse ham metni dondur
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** Metinden ilk JSON nesnesini ayiklar (kod blogu/prose olsa bile). */
function extractJson(s: string): string {
  let t = s.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}
