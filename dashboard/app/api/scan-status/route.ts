import { NextResponse } from "next/server";
import { readScanStatus } from "../../lib/scan";

// Client bu endpoint'i canli ilerleme icin polling yapar.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readScanStatus());
}
