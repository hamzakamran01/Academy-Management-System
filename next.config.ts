import type { NextConfig } from "next";

// Security headers per SRS NFR-SEC-07. CSP keeps scripts to self; Next needs
// 'unsafe-inline' for its hydration bootstrap until we move to nonces.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "web-push", "exceljs", "@electric-sql/pglite"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Client router cache: revisiting a tab within 30 s is instant (mutations call
    // router.refresh(), which clears it, so edits still show immediately).
    staleTimes: { dynamic: 30, static: 300 },
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // PGlite (local dev only) and its contrib extensions locate their WASM/tarballs
      // relative to their own files, so they must be loaded from node_modules, not bundled.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }: { request?: string }, cb: (err?: Error | null, result?: string) => void) =>
          request?.startsWith("@electric-sql/pglite") ? cb(null, `import ${request}`) : cb(),
      ];
    }
    return config;
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
