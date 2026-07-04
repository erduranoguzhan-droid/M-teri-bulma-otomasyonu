import { promises as fs } from "fs";
import path from "path";
import type { ScanStatus } from "./scan-types";

// Server-only: durum dosyasini okur (vertex-leadgen/data/scan-status.json).
const STATUS_PATH = path.join(process.cwd(), "..", "data", "scan-status.json");

export async function readScanStatus(): Promise<ScanStatus | null> {
  try {
    return JSON.parse(await fs.readFile(STATUS_PATH, "utf8")) as ScanStatus;
  } catch {
    return null;
  }
}

export function isScanActive(s: ScanStatus | null): boolean {
  if (!s || !s.running) return false;
  if (s.startedAt && Date.now() - new Date(s.startedAt).getTime() > 30 * 60_000) return false;
  return true;
}
