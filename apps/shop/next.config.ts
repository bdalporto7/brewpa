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
  images: {
    // Bean photos are uploaded by apps/roasting to Vercel Blob (public URLs).
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
