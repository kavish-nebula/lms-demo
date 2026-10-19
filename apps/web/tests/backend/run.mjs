// Bundles backend-test.ts with the app's tsconfig paths and runs it against an in-memory
// database, with a stand-in for the GLM API (no API calls). Run from apps/web: node tests/backend/run.mjs
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const suite = process.argv[2] === "adaptive" ? "adaptive-onboarding-test.ts" : process.argv[2] === "adaptive-profiling" ? "adaptive-profiling-test.ts" : process.argv[2] === "engagement" ? "engagement-test.ts" : process.argv[2] === "workflow" ? "workflow-test.ts" : process.argv[2] === "companion" ? "companion-test.ts" : process.argv[2] === "profiling" ? "profiling-test.ts" : process.argv[2] === "profiling-api" ? "profiling-api-test.ts" : process.argv[2] === "interview" ? "interview-test.ts" : process.argv[2] === "adapt" ? "adapt-test.ts" : "backend-test.ts";
// generated files go to the gitignored .data folder
const out = path.join(here, "..", "..", ".data", "tests");
mkdirSync(out, { recursive: true });
const empty = path.join(out, "empty.js");
writeFileSync(empty, "export {};\n");
const nextServer = path.join(out, "next-server.js");
writeFileSync(nextServer, "export const NextResponse = { json: (d, init) => new Response(JSON.stringify(d), init) };\nexport const after = (fn) => void fn();\n");

await build({
  entryPoints: [path.join(here, suite)],
  outfile: path.join(out, "out.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: path.join(here, "..", "..", "tsconfig.json"),
  alias: { "server-only": empty, "next/server": nextServer, ...(["adaptive-onboarding-test.ts", "adaptive-profiling-test.ts"].includes(suite) ? {
    "@/server/ai/gemini": path.join(here, "adaptive-ai-fixture.ts"),
    "@/server/ai/gemini-image": path.join(here, "adaptive-ai-fixture.ts"),
    "@/server/ai/gemini-tts": path.join(here, "adaptive-ai-fixture.ts"),
  } : {}) },
  external: ["@electric-sql/pglite", "pg", "drizzle-orm", "zod", "react", "react-dom", "google-auth-library"],
  logLevel: "warning",
});
execFileSync(process.execPath, [path.join(out, "out.mjs")], { stdio: "inherit", env: { ...process.env, PGLITE_DIR: "memory://", GOOGLE_CLOUD_PROJECT: "", GEMINI_API_KEY: "", GLM_API_KEY: "", LLM_API_KEY: "", AUDIO: "off", AUDIO_API_KEY: "", KOKORO: "off", PLATFORM_ENGAGEMENT_ENABLED: suite === "engagement-test.ts" ? "true" : "false" } });
