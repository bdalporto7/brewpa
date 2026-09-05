import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // apps/desktop's prepare-app.js copies this whole directory (its own
  // fresh package-lock.json included) into a sibling of apps/desktop's own
  // lockfile — with no npm/pnpm workspace tying the two together, Next
  // can't tell which is the "real" root and warns. There's only ever one
  // real root: wherever this config file itself lives.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // libsql's client resolves its native per-platform addon via a computed
  // require() at runtime — exactly the kind of dynamic import a bundler's
  // static analysis can miss. Treating it as an external keeps Next from
  // trying to bundle it into the server chunk at all; deliberately no
  // `output: "standalone"` here either (see apps/desktop's plan notes) —
  // that mode's file tracing has a live, open issue missing Prisma/libsql's
  // native files on Next 16, and the size savings it exists for don't
  // matter for a desktop installer the way they do for a serverless bundle.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
