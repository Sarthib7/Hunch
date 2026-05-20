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
  // Turbopack infer the wrong root, so pin it explicitly.
  turbopack: {
    root: process.cwd(),
  },
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
