// Tarama Gecmisi veri katmani (leads.ts gibi: STORAGE_BACKEND'e gore Supabase veya JSON).
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "./types";
import { getLeads } from "./leads";

export type ScanRunMode = "sector" | "company";
export type ScanRunStatus = "running" | "completed" | "cancelled" | "error";

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
  message?: string;
  params?: Record<string, unknown>;
}

const useSupabase = process.env.STORAGE_BACKEND === "supabase";

let sb: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!sb) {
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_KEY ?? "";
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY tanimli degil.");
    sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return sb;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToScan(r: any): ScanRecord {
  return {
    id: r.id,
    name: r.name,
    mode: r.mode,
    status: r.status,
    city: r.city ?? undefined,
    districts: r.districts ?? undefined,
    categories: r.categories ?? undefined,
    queryTotal: r.query_total ?? 0,
    foundCount: r.found_count ?? 0,
    leadCount: r.lead_count ?? 0,
    avgScore: r.avg_score ?? undefined,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
    durationS: r.duration_s ?? undefined,
    message: r.message ?? undefined,
    params: r.params ?? undefined,
  };
}

const SCANS_JSON = path.join(process.cwd(), "..", "data", "scans.json");

async function readJsonScans(): Promise<ScanRecord[]> {
  try {
    return JSON.parse(await fs.readFile(SCANS_JSON, "utf8")) as ScanRecord[];
  } catch {
    return [];
  }
}

export async function getScans(): Promise<ScanRecord[]> {
  if (useSupabase) {
    const { data, error } = await client().from("scans").select("*").order("started_at", { ascending: false });
    if (error) throw new Error(`getScans: ${error.message}`);
    return (data ?? []).map(rowToScan);
  }
  const scans = await readJsonScans();
  return [...scans].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

export async function getScan(id: string): Promise<ScanRecord | undefined> {
  if (useSupabase) {
    const { data, error } = await client().from("scans").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getScan: ${error.message}`);
    return data ? rowToScan(data) : undefined;
  }
  return (await readJsonScans()).find((s) => s.id === id);
}

/** Bir taramanin urettigi leadler (scanId ile). */
export async function getScanLeads(id: string): Promise<Lead[]> {
  const leads = await getLeads();
  return leads.filter((l) => l.scanId === id);
}

// --- Mutasyonlar (Tarama Gecmisi aksiyonlari) ---
export async function renameScan(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  if (useSupabase) {
    const { error } = await client().from("scans").update({ name: clean }).eq("id", id);
    if (error) throw new Error(`renameScan: ${error.message}`);
    return;
  }
  const scans = await readJsonScans();
  const i = scans.findIndex((s) => s.id === id);
  if (i >= 0) {
    scans[i] = { ...scans[i]!, name: clean };
    await writeJsonScans(scans);
  }
}

export async function deleteScan(id: string): Promise<void> {
  if (useSupabase) {
    // scan_logs cascade ile silinir; leadler korunur (scan_id null'a cekilir).
    await client().from("leads").update({ scan_id: null }).eq("scan_id", id);
    const { error } = await client().from("scans").delete().eq("id", id);
    if (error) throw new Error(`deleteScan: ${error.message}`);
    return;
  }
  const scans = (await readJsonScans()).filter((s) => s.id !== id);
  await writeJsonScans(scans);
}

async function writeJsonScans(scans: ScanRecord[]): Promise<void> {
  const tmp = `${SCANS_JSON}.dash.tmp`;
  await fs.writeFile(tmp, JSON.stringify(scans, null, 2), "utf8");
  await fs.rename(tmp, SCANS_JSON);
}
