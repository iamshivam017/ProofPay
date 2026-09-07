import { NextResponse } from "next/server";

import { getConfigStatus } from "@/src/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const config = getConfigStatus();
  return NextResponse.json(
    {
      status: "ok",
      configured: config.configured,
      network: "base-sepolia",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
