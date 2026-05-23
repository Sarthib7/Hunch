import type { NextConfig } from "next";

// The Circles host loads miniapps inside an iframe. Default Next.js responses
// would block that with `X-Frame-Options: SAMEORIGIN`, so we explicitly allow
// the Circles host (prod + dev + any future subdomain) and Vercel preview deploys.
const FRAME_ANCESTORS = [
  "'self'",
  "https://*.gnosis.io",
  "https://*.vercel.app",
].join(" ");

const nextConfig: NextConfig = {
  // app/ is the project root. Stray lockfiles in parent directories make
  // Turbopack infer the wrong root, so pin it explicitly. Vercel's build
  // setup also injects outputFileTracingRoot; the two must match or Next 16
  // bails with "Couldn't find any app directory".
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  // Dev only: let the ngrok tunnel load Next.js dev resources (HMR, chunks).
  allowedDevOrigins: [
    "conducive-unpenetratively-joaquina.ngrok-free.dev",
    "*.ngrok-free.dev",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
