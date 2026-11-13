import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { parseHourKey } from "@/lib/hour";
import { runHourlyIngest } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called at :55 every hour by the Worker's Cron Trigger (worker.ts), or manually with the bearer token.
 * Builds the next hour's edition and publishes it;
 * readers see it at :00. Optional ?hour=YYYY-MM-DD-HH backfills a specific slot.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const hourParam = new URL(req.url).searchParams.get("hour");
  const hour = hourParam ? parseHourKey(hourParam) : undefined;
  if (hourParam && !hour) return NextResponse.json({ error: "hour must be YYYY-MM-DD-HH (UTC)" }, { status: 400 });

  try {
    const result = await runHourlyIngest({ hour: hour ?? undefined });
    console.log("[hourly-ingest]", JSON.stringify({ ...result, feedErrors: result.feedErrors.length }));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[hourly-ingest] failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "ingest failed" }, { status: 500 });
  }
}
