import { NextResponse } from "next/server";

import { getConfigStatus } from "@/src/lib/config";
import { getTelemetrySnapshot } from "@/src/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const config = getConfigStatus();
  return NextResponse.json(
    {
      configured: config.configured,
      missing: config.missing,
      warnings: config.warnings,
      network: "base-sepolia",
      telemetry: getTelemetrySnapshot(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
