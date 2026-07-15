// Tarama kalicilik katmani — her tarama koşusu + canli loglar DB'ye yazilir (Tarama Gecmisi).
// storage.ts felsefesi: config.storageBackend'e gore Supabase veya JSON. UI bunu okur.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, requireSupabase } from "./config.js";

export type ScanRunMode = "sector" | "company";
export type ScanRunStatus = "running" | "completed" | "cancelled" | "error";
export type ScanLogLevel = "info" | "success" | "warn" | "error";

export interface ScanRecord {
  id: string;
  name: string;
  mode: ScanRunMode;
  status: ScanRunStatus;
  city?: string;
  districts?: string;
  categories?: string;
  queryTotal: number;
  foundCount: number;
  leadCount: number;
  avgScore?: number;
  startedAt: string;
  finishedAt?: string;
  durationS?: number;
  params?: unknown;
  message?: string;
}

export interface ScanLogRow {
  scanId: string;
  ts: string;
  level: ScanLogLevel;
  phase?: string;
  message: string;
  meta?: unknown;
}

export interface ScanStore {
  start(rec: ScanRecord): Promise<void>;
  update(id: string, patch: Partial<ScanRecord>): Promise<void>;
  finish(id: string, patch: Partial<ScanRecord> & { status: ScanRunStatus }): Promise<void>;
  log(scanId: string, level: ScanLogLevel, phase: string | undefined, message: string, meta?: unknown): Promise<void>;
}

export function createScanStore(): ScanStore {
  return config.storageBackend === "supabase" ? new SupabaseScanStore() : new JsonScanStore();
}

/** startedAt'ten finishedAt + durationS turetir (finalize kolayligi). */
export function finalizePatch(
  startedAt: string,
  patch: Partial<ScanRecord> & { status: ScanRunStatus },
): Partial<ScanRecord> & { status: ScanRunStatus } {
  const finishedAt = new Date().toISOString();
  const durationS = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000));
  return { finishedAt, durationS, ...patch };
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
function recToRow(r: Partial<ScanRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v ?? null;
  };
  set("id", r.id);
  set("name", r.name);
  set("mode", r.mode);
  set("status", r.status);
  set("city", r.city);
  set("districts", r.districts);
  set("categories", r.categories);
  set("query_total", r.queryTotal);
  set("found_count", r.foundCount);
  set("lead_count", r.leadCount);
  set("avg_score", r.avgScore);
  set("started_at", r.startedAt);
  set("finished_at", r.finishedAt);
  set("duration_s", r.durationS);
  set("params", r.params);
  set("message", r.message);
  return row;
}

class SupabaseScanStore implements ScanStore {
  private readonly sb: SupabaseClient;
  constructor() {
    const { url, key } = requireSupabase();
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }
  async start(rec: ScanRecord): Promise<void> {
    const { error } = await this.sb.from("scans").insert(recToRow(rec));
    if (error) throw new Error(`scanStore.start: ${error.message}`);
  }
  async update(id: string, patch: Partial<ScanRecord>): Promise<void> {
    const { error } = await this.sb.from("scans").update(recToRow(patch)).eq("id", id);
    if (error) throw new Error(`scanStore.update: ${error.message}`);
  }
  async finish(id: string, patch: Partial<ScanRecord> & { status: ScanRunStatus }): Promise<void> {
    await this.update(id, patch);
  }
  async log(scanId: string, level: ScanLogLevel, phase: string | undefined, message: string, meta?: unknown): Promise<void> {
    // Log yazimi tarama akisini durdurmasin (best-effort).
    const { error } = await this.sb.from("scan_logs").insert({
      scan_id: scanId, level, phase: phase ?? null, message, meta: meta ?? null,
    });
    if (error) console.warn(`scanStore.log: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// JSON (yerel gelistirme)
// ---------------------------------------------------------------------------
const SCANS_PATH = "data/scans.json";
const SCAN_LOGS_PATH = "data/scan-logs.json";

async function readJson<T>(path: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T[];
  } catch {
    return [];
  }
}
async function writeJson<T>(path: string, rows: T[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await rename(tmp, path);
}

class JsonScanStore implements ScanStore {
  async start(rec: ScanRecord): Promise<void> {
    const scans = await readJson<ScanRecord>(SCANS_PATH);
    scans.unshift(rec);
    await writeJson(SCANS_PATH, scans);
  }
  async update(id: string, patch: Partial<ScanRecord>): Promise<void> {
    const scans = await readJson<ScanRecord>(SCANS_PATH);
    const i = scans.findIndex((s) => s.id === id);
    if (i >= 0) {
      scans[i] = { ...scans[i]!, ...patch };
      await writeJson(SCANS_PATH, scans);
    }
  }
  async finish(id: string, patch: Partial<ScanRecord> & { status: ScanRunStatus }): Promise<void> {
    await this.update(id, patch);
  }
  async log(scanId: string, level: ScanLogLevel, phase: string | undefined, message: string, meta?: unknown): Promise<void> {
    const logs = await readJson<ScanLogRow>(SCAN_LOGS_PATH);
    logs.push({ scanId, ts: new Date().toISOString(), level, phase, message, meta });
    await writeJson(SCAN_LOGS_PATH, logs);
  }
}
