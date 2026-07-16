import { NextResponse } from "next/server";
import { readScanStatusNormalized } from "../../lib/scan";

// Client bu endpoint'i canli ilerleme icin polling yapar.
// Normalize edilmis durum doner: olmus bir tarama "calisiyor" gorunmez.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readScanStatusNormalized());
}
