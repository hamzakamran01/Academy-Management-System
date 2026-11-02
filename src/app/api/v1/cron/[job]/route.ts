import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/auth/crypto";
import { jobCleanup, jobLessonLogReminder, jobMonthlyRows, jobResultsReminder, jobWeeklyPlanReminder, tick } from "@/server/modules/jobs";
import { sendDailySummaries, sendPendingPushes } from "@/server/modules/push";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<unknown>> = {
  tick,
  "push-sender": () => sendPendingPushes(),
  "monthly-rows": () => jobMonthlyRows(),
  "lesson-log-reminder": jobLessonLogReminder,
  "weekly-plan-reminder": jobWeeklyPlanReminder,
  "results-reminder": jobResultsReminder,
  "parent-daily-summary": sendDailySummaries,
  cleanup: jobCleanup,
};

/**
 * Scheduler entry point (SRS §9). Call /api/v1/cron/tick every 5–15 minutes
 * with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it automatically).
 */
async function handle(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Bad cron secret" } }, { status: 403 });
  const { job } = await params;
  const fn = JOBS[job];
  if (!fn) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown job" } }, { status: 404 });
  try {
    return NextResponse.json({ job, result: await fn() });
  } catch (err) {
    console.error("[cron]", job, err);
    return NextResponse.json({ error: { code: "JOB_FAILED", message: err instanceof Error ? err.message : "failed" } }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
