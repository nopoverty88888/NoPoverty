import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/keep-alive — Supabase free-tier keep-alive.
 *
 * Invoked once a day by Vercel Cron (schedule in `vercel.json`). Supabase pauses
 * a Free-plan project after 7 days without *database* activity, and this app's
 * usage is a monthly cycle (發券 at month start, 回收 at month end) with quiet
 * weeks in between — so a scheduled ping is needed in production, not just
 * during development.
 *
 * The ping must be a real query that reaches Postgres. A GoTrue `/auth/v1/health`
 * ping (the previous GitHub Action) returns 200 but does NOT count as activity:
 * the project was paused in Sep 2026 while that action was green. We read one
 * row-count from `ngos` with the service-role client because the `anon` role
 * deliberately has no table grants (auth is `authenticated` + RLS).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail loudly (5xx shows up red in the Vercel cron log) rather than silently
    // 401-ing forever — a silently-broken keep-alive is how the project got paused.
    console.error("[keep-alive] CRON_SECRET is not set on this deployment");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("ngos")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[keep-alive] Supabase query failed:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
