// UI review helper: signs in and screenshots pages at phone (and optionally desktop) size.
//   node scripts/screens.mjs <outDir> <phone> <path> [path…] [--desktop] [--dark]
import { chromium } from "playwright-core";

const [out, phone, ...rest] = process.argv.slice(2);
const desktop = rest.includes("--desktop");
const dark = rest.includes("--dark");
const paths = rest.filter((p) => !p.startsWith("--"));
const base = process.env.BASE ?? "http://localhost:3000";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({
  viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  deviceScaleFactor: desktop ? 1 : 2,
  isMobile: !desktop,
  hasTouch: !desktop,
  colorScheme: dark ? "dark" : "light",
});
const page = await ctx.newPage();
const res = await page.request.post(`${base}/api/v1/auth/login`, { data: { phone, password: "Campusly#2026" } });
if (!res.ok()) throw new Error(`login failed ${res.status()}`);
for (const p of paths) {
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(400);
  const file = `${out}/${name}${desktop ? "_desktop" : ""}${dark ? "_dark" : ""}.png`;
  await page.screenshot({ path: file, fullPage: !desktop });
  console.log(file);
}
await browser.close();
