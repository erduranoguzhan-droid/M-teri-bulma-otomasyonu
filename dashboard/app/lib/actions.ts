"use server";

import { spawn } from "child_process";
import path from "path";
import { revalidatePath } from "next/cache";
import { markContacted, setDealValue, setStatus, snoozeFollowUp } from "./leads";
import { isScanActive, readScanStatus } from "./scan";
import type { ContactChannel, CrmStatus } from "./types";

function revalidate(id: string): void {
  revalidatePath("/");
  revalidatePath(`/lead/${id}`);
}

export async function updateStatus(id: string, status: CrmStatus): Promise<void> {
  await setStatus(id, status);
  revalidate(id);
}

export async function markContactedAction(id: string, channel: ContactChannel): Promise<void> {
  await markContacted(id, channel);
  revalidate(id);
}

export async function snoozeFollowUpAction(id: string, days: number): Promise<void> {
  await snoozeFollowUp(id, days);
  revalidate(id);
}

export async function setDealValueAction(id: string, value: number | null): Promise<void> {
  await setDealValue(id, value);
  revalidate(id);
}

export async function bulkUpdateStatusAction(ids: string[], status: CrmStatus): Promise<number> {
  const unique = [...new Set(ids)];
  for (const id of unique) await setStatus(id, status);
  revalidatePath("/");
  for (const id of unique) revalidatePath(`/lead/${id}`);
  return unique.length;
}

export interface StartScanInput {
  city: string;
  districts: string;
  categories: string;
  max: number;
}

export async function startScanAction(
  input: StartScanInput,
): Promise<{ ok: boolean; error?: string }> {
  // Vercel/serverless'ta tarama (Playwright + CLI) calismaz — yerelde yapilir.
  if (process.env.VERCEL) {
    return { ok: false, error: "Tarama yalnızca yerelde çalışır (npm run scan). Canlı panel oku/yönet/gönder amaçlıdır." };
  }
  if (isScanActive(await readScanStatus())) {
    return { ok: false, error: "Zaten bir tarama çalışıyor." };
  }
  const hasScope = [input.city, input.districts, input.categories].some((v) => v.trim());
  if (!hasScope) {
    return { ok: false, error: "En az şehir veya ilçe/kategori gir." };
  }

  // CLI scan'i ana dizinde arka planda (detached) baslat.
  const parent = path.join(process.cwd(), "..");
  const args = [
    "run", "scan", "--",
    "--city", input.city,
    "--districts", input.districts,
    "--categories", input.categories,
    "--max", String(Math.max(1, Math.min(30, input.max || 15))),
  ];
  const child = spawn("npm", args, {
    cwd: parent,
    detached: true,
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return { ok: true };
}

export interface StartCompanyScanInput {
  names: string; // virgül/yeni satır ile ayrılmış firma adları
  country: string;
  city: string;
  lang: "tr" | "en";
  max: number;
  depth: "quick" | "standard" | "deep";
}

export async function startCompanyScanAction(
  input: StartCompanyScanInput,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.VERCEL) {
    return { ok: false, error: "Tarama yalnızca yerelde çalışır (npm run scan:company). Canlı panel oku/yönet/gönder amaçlıdır." };
  }
  if (isScanActive(await readScanStatus())) {
    return { ok: false, error: "Zaten bir tarama çalışıyor." };
  }
  const names = input.names.trim();
  if (!names) {
    return { ok: false, error: "En az bir firma adı gir." };
  }

  const parent = path.join(process.cwd(), "..");
  const args = [
    "run", "scan:company", "--",
    "--names", names,
    "--depth", input.depth,
    "--lang", input.lang,
    "--max", String(Math.max(1, Math.min(200, input.max || 50))),
  ];
  if (input.country.trim()) args.push("--country", input.country.trim());
  if (input.city.trim()) args.push("--city", input.city.trim());

  const child = spawn("npm", args, {
    cwd: parent,
    detached: true,
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return { ok: true };
}
