import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root: workspace packages (@lms/ui, @lms/i18n, @lms/fixtures) live outside apps/web.
const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // PGlite (the built-in local Postgres) ships WASM; load it from node_modules
  // at runtime rather than through the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      // What next-intl/plugin would add. The plugin itself is not used because it
      // loads @swc/core's native binary at config time, whose install script
      // npm blocks by default. Re-enable the plugin if message extraction is needed.
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Two root layouts ((app) light, (marketing) Aurora) means no single layout
    // can compose a 404, so unmatched URLs use app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
