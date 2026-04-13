import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon and must not be bundled into the RSC graph.
  serverExternalPackages: ["better-sqlite3"],

  // The SQLite DB is a static asset that lib/db.ts opens at runtime via a
  // dynamic path. Next's file tracer can't see it, so tell it explicitly so
  // the file ships with every serverless function that might read from it.
  outputFileTracingIncludes: {
    "/**/*": ["./data/federal_ai_inventory_2025.db"],
  },
};

export default nextConfig;
