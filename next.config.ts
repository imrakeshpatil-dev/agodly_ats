import type { NextConfig } from "next";

// Content-Security-Policy mirrors the old helmet config, with the additions
// Next.js requires (inline/eval for hydration and the pdf.js worker). External
// CDNs used by the UI (fonts, bootstrap CSS, pdf.js, mammoth) are allow-listed.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep native/large modules out of the server bundle; load them from node_modules at runtime.
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "pdf-parse",
    "mammoth"
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" }
        ]
      }
    ];
  }
};

export default nextConfig;
