import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Same reason as apps/roasting/next.config.ts: Turbopack bundling Prisma's
  // WASM query compiler mis-decodes some stored DateTimes (P2023), and
  // libsql resolves a native addon via a dynamic require. Keep all three
  // external.
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql", "@prisma/client"],
  // Admin photo uploads are shrunk in the browser first; this just lifts the 1 MB default.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    // Bean photos: Vercel Blob (uploaded by apps/roasting) or Square's catalog
    // image storage (sandbox and production buckets).
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "items-images-sandbox.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "items-images-production.s3.us-west-2.amazonaws.com" },
    ],
  },
};

export default nextConfig;
