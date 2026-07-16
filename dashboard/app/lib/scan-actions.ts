"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { deleteScan, getScan, renameScan } from "./scans";
import { isScanActive, readScanStatus } from "./scan";
import { spawnNpmDetached } from "./spawn";

export async function renameScanAction(id: string, name: string): Promise<void> {
  await renameScan(id, name);
  revalidatePath("/scans");
  revalidatePath(`/scans/${id}`);
}

export async function deleteScanAction(id: string): Promise<void> {
  await deleteScan(id);
  revalidatePath("/scans");
}

/** Bir gecmis taramayi ayni parametrelerle yeniden calistirir (yeni kayit olusur). */
export async function rerunScanAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.VERCEL) {
    return { ok: false, error: "Tarama yalnızca yerelde çalışır." };
  }
  if (isScanActive(await readScanStatus())) {
    return { ok: false, error: "Zaten bir tarama çalışıyor." };
  }
  const scan = await getScan(id);
  if (!scan) return { ok: false, error: "Tarama bulunamadı." };

  const parent = path.join(process.cwd(), "..");
  const params = (scan.params ?? {}) as Record<string, unknown>;
  let args: string[];

  if (scan.mode === "company") {
    const names = Array.isArray(params.names) ? (params.names as string[]).join(", ") : "";
    if (!names) return { ok: false, error: "Firma listesi kaydı yok." };
    args = ["run", "scan:company", "--", "--names", names, "--depth", String(params.depth ?? "standard")];
    if (params.lang) args.push("--lang", String(params.lang));
    if (params.withCompetitors) args.push("--with-competitors");
  } else {
    args = ["run", "scan", "--"];
    if (scan.city) args.push("--city", scan.city);
    if (scan.districts) args.push("--districts", scan.districts);
    if (scan.categories) args.push("--categories", scan.categories);
    args.push("--max", String(params.max ?? 15));
  }

  spawnNpmDetached(args, parent);
  revalidatePath("/scans");
  return { ok: true };
}
