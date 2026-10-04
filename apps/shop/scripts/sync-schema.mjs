// apps/roasting owns the database schema and every migration; this app only
// reads (and, for orders, writes) the same database. Rather than hand-copying
// schema.prisma and risking drift, copy it from apps/roasting whenever that
// file is reachable (local dev, and Vercel builds that include files outside
// the Root Directory). The committed copy is the fallback when it isn't.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../../roasting/prisma/schema.prisma");
const target = path.resolve(here, "../prisma/schema.prisma");

if (fs.existsSync(source)) {
  const header =
    "// GENERATED COPY of apps/roasting/prisma/schema.prisma — do not edit here.\n" +
    "// Edit the roasting app's schema (it owns migrations), then run `npm run sync-schema`.\n\n";
  fs.writeFileSync(target, header + fs.readFileSync(source, "utf8"));
  console.log("sync-schema: copied apps/roasting/prisma/schema.prisma");
} else if (fs.existsSync(target)) {
  console.log("sync-schema: apps/roasting not reachable, using committed copy");
} else {
  console.error("sync-schema: no schema found — apps/roasting/prisma/schema.prisma is missing");
  process.exit(1);
}
