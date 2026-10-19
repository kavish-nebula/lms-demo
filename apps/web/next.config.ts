import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root: workspace packages (@lms/ui, @lms/i18n, @lms/fixtures) live outside apps/web.
const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/pyodide/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
  outputFileTracingRoot: monorepoRoot,
  // PGlite (the built-in local Postgres) ships WASM; load it from node_modules
  // at runtime rather than through the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "kokoro-js", "@huggingface/transformers", "onnxruntime-node", "phonemizer", "sharp"],
  webpack(config) {
    config.resolve.alias["next-intl/config"] = path.join(__dirname, "src", "i18n", "request.ts");
    return config;
  },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      // What next-intl/plugin would add. The plugin itself is not used because it
      // loads @swc/core's native binary at config time, whose install script
      // npm blocks by default. Re-enable the plugin if message extraction is needed.
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
  experimental: {
    ...(process.env.LMS_SERIAL_BUILD === "true" ? { webpackBuildWorker: false, cpus: 1 } : {}),
    // Two root layouts ((app) light, (marketing) Aurora) means no single layout
    // can compose a 404, so unmatched URLs use app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
