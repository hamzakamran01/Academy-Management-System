// UX audit helper: signs in as a role, screenshots each path (phone viewport, first screen),
// and composes them into labelled 4-up grids for review.
//   node scripts/audit-shots.mjs <outDir> <phone> <label> <path> [path…]
import { chromium } from "playwright-core";
import sharp from "sharp";

const [out, phone, label, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
if (phone !== "-") {
  const res = await page.request.post(`${base}/api/v1/auth/login`, { data: { phone, password: "Campusly#2026" } });
  if (!res.ok()) throw new Error(`login failed ${res.status()}`);
}
const shots = [];
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 180_000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(300);
  shots.push({ p, buf: await page.screenshot() });
}
await browser.close();
for (let i = 0; i < shots.length; i += 4) {
  const group = shots.slice(i, i + 4);
  const tiles = await Promise.all(
    group.map(async ({ p, buf }) => {
      const caption = Buffer.from(`<svg width="390" height="28"><rect width="390" height="28" fill="#111"/><text x="8" y="19" font-family="Arial" font-size="14" fill="#fff">${p.replace(/&/g, "&amp;").slice(0, 52)}</text></svg>`);
      return sharp({ create: { width: 390, height: 872, channels: 3, background: "#fff" } })
        .composite([{ input: caption, top: 0, left: 0 }, { input: buf, top: 28, left: 0 }])
        .png()
        .toBuffer();
    }),
  );
  const file = `${out}/${label}_${i / 4 + 1}.png`;
  await sharp({ create: { width: 390 * 4 + 30, height: 872, channels: 3, background: "#777" } })
    .composite(tiles.map((t, k) => ({ input: t, left: k * 400, top: 0 })))
    .png()
    .toFile(file);
  console.log(file);
}
