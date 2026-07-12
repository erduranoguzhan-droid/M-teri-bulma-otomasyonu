import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

export type ScanPhase = "idle" | "find" | "enrich" | "analyze" | "outreach" | "done" | "error";

/** Firma-bazli modda her firmanin ilerleme durumu. */
export type CompanyItemPhase =
  | "waiting"
  | "searching"
  | "scraping"
  | "enriching"
  | "ai_analyzing"
  | "completed"
  | "error";

export interface CompanyScanItem {
  name: string;
  phase: CompanyItemPhase;
  leadId?: string;
  message?: string;
}

export interface ScanStatus {
  running: boolean;
  phase: ScanPhase;
  startedAt?: string;
  finishedAt?: string;
  queries: string[];
  queryIndex: number; // 0-tabanli, find asamasindaki mevcut sorgu
  queryTotal: number;
  found: number; // bu taramada bulunan toplam firma
  message?: string;
  // Firma-bazli mod (opsiyonel; sektor modu bunlari kullanmaz).
  mode?: "sector" | "company";
  items?: CompanyScanItem[];
}

export const SCAN_STATUS_PATH = "data/scan-status.json";

export async function readScanStatus(path = SCAN_STATUS_PATH): Promise<ScanStatus | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ScanStatus;
  } catch {
    return null;
  }
}

export async function writeScanStatus(status: ScanStatus, path = SCAN_STATUS_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(status, null, 2), "utf8");
  await rename(tmp, path);
}

/** Bir taramanin gercekten hala calisip calismadigi (eski/kalinti durumu ele). */
export function isScanActive(s: ScanStatus | null): boolean {
  if (!s || !s.running) return false;
  // 30 dk'dan eski "running" durumu kalinti say (surec cokmus olabilir).
  if (s.startedAt && Date.now() - new Date(s.startedAt).getTime() > 30 * 60_000) return false;
  return true;
}
