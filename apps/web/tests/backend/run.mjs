// Bundles backend-test.ts with the app's tsconfig paths and runs it against an in-memory
// database, with a stand-in for the GLM API (no API calls). Run from apps/web: node tests/backend/run.mjs
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
// generated files go to the gitignored .data folder
const out = path.join(here, "..", "..", ".data", "tests");
mkdirSync(out, { recursive: true });
const empty = path.join(out, "empty.js");
writeFileSync(empty, "export {};\n");
const nextServer = path.join(out, "next-server.js");
writeFileSync(nextServer, "export const NextResponse = { json: (d, init) => new Response(JSON.stringify(d), init) };\nexport const after = (fn) => void fn();\n");

await build({
  entryPoints: [path.join(here, "backend-test.ts")],
  outfile: path.join(out, "out.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: path.join(here, "..", "..", "tsconfig.json"),
  alias: { "server-only": empty, "next/server": nextServer },
  external: ["@electric-sql/pglite", "pg", "drizzle-orm", "zod", "react", "react-dom"],
  logLevel: "warning",
});
execFileSync(process.execPath, [path.join(out, "out.mjs")], { stdio: "inherit", env: { ...process.env, PGLITE_DIR: "memory://", GLM_API_KEY: "" } });
