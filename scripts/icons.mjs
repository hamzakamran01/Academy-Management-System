// Renders PWA icons from public/icon.svg (run once: node scripts/icons.mjs)
import sharp from "sharp";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icon.svg");
const full = (size) => sharp(svg, { density: 1200 }).resize(size, size).png();
await full(192).toFile("public/icons/icon-192.png");
await full(512).toFile("public/icons/icon-512.png");
await full(180).toFile("public/icons/apple-touch-icon.png");
// Maskable: art inside the 80% safe zone on a solid background
const inner = await sharp(svg, { density: 1200 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#4f46e5" } })
  .composite([{ input: inner, gravity: "center" }]).png().toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
