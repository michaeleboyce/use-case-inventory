import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep this explicit even though Next 16 already treats better-sqlite3 as a
  // server-external package; the dashboard query layer relies on Node's native
  // addon loading path.
  serverExternalPackages: ["better-sqlite3"],

  // The SQLite DB is a static asset that @/lib/db opens at runtime via a
  // dynamic path. Next's file tracer can't see it, so tell it explicitly so
  // the file ships with every serverless function that might read from it.
  outputFileTracingIncludes: {
    "/**/*": ["./data/federal_ai_inventory_2025.db"],
  },

  // July 2026 IA restructure. Temporary (307) so a bad move is reversible;
  // flip to permanent: true after a release cycle with no complaints.
  async redirects() {
    return [
      {
        source: "/compare",
        destination: "/agencies/compare",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
