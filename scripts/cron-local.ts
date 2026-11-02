/**
 * Local scheduler: calls /api/v1/cron/tick every N minutes while `npm run dev` is running.
 *   npm run cron:local            # every 15 minutes
 *   npm run cron:local -- 1       # every minute (testing)
 */
import "dotenv/config";

const minutes = Number(process.argv[2] ?? 15);
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set in .env");
  process.exit(1);
}

async function tick() {
  const at = new Date().toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" });
  try {
    const res = await fetch(`${base}/api/v1/cron/tick`, { headers: { Authorization: `Bearer ${secret}` } });
    const body = (await res.json()) as { result?: { results?: { job: string; skipped?: boolean; ok?: boolean }[] } };
    const ran = (body.result?.results ?? []).filter((r) => !r.skipped).map((r) => r.job);
    console.log(`[${at}] tick ${res.status} — ran: ${ran.join(", ") || "nothing due"}`);
  } catch (err) {
    console.log(`[${at}] tick failed — is npm run dev running? (${err instanceof Error ? err.message : err})`);
  }
}

console.log(`Local scheduler: ticking ${base} every ${minutes} min. Ctrl+C to stop.`);
void tick();
setInterval(tick, minutes * 60_000);
