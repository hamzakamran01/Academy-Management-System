const productionOrigin = "https://kms-campusly.vercel.app";
const demoOrigin = "http://localhost:3000";

export function setupUrl(raw: string): string {
  if (process.env.VERCEL_ENV === "production") return `${productionOrigin}/setup/${encodeURIComponent(raw)}`;
  const isDemo = process.env.DATABASE_URL?.startsWith("pglite:") === true;
  let origin = isDemo ? demoOrigin : productionOrigin;
  const appUrl = process.env.APP_URL?.trim() ?? "";
  if (URL.canParse(appUrl)) {
    const configured = new URL(appUrl);
    if (configured.protocol === "https:" || (isDemo && configured.protocol === "http:")) {
      origin = configured.origin;
    }
  }
  return `${origin}/setup/${encodeURIComponent(raw)}`;
}
