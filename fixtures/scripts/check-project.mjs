/**
 * Checks the AI agent course's mini project with a local Python (3.10+):
 * the starter must fail the hidden tickets and the reference solution must
 * pass them all, so the project is neither given away nor impossible.
 *
 *   node fixtures/scripts/check-project.mjs            starter and solution
 *   node fixtures/scripts/check-project.mjs --show     also print every ticket
 *
 * Grading uses the app's own grader (apps/web/src/lib/project-grade.ts).
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// the grader is TypeScript, run by Node as is; keep its "experimental" notice out of the report
process.removeAllListeners("warning");

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src", "ai-agent", "project");
const { gradeProject } = await import(pathToFileURL(path.join(here, "..", "..", "apps", "web", "src", "lib", "project-grade.ts")).href);
const show = process.argv.includes("--show");

const tickets = JSON.parse(readFileSync(path.join(SRC, "tickets.json"), "utf8"));
const strip = ({ expect: _e, ...t }) => t;

function python() {
  for (const cmd of ["python", "python3", "py"]) {
    try {
      execFileSync(cmd, ["--version"], { stdio: "ignore" });
      return cmd;
    } catch {}
  }
  throw new Error("No Python found: install Python 3.10+ to check the project.");
}
const py = python();

function runEngine(engineFile, list, seeds) {
  const dir = mkdtempSync(path.join(tmpdir(), "scout-"));
  try {
    cpSync(path.join(SRC, "orbit"), path.join(dir, "orbit"), { recursive: true });
    cpSync(path.join(SRC, "docs"), path.join(dir, "docs"), { recursive: true });
    cpSync(path.join(SRC, "run.py"), path.join(dir, "run.py"));
    cpSync(engineFile, path.join(dir, "prompt_engine.py"));
    writeFileSync(path.join(dir, "tickets.json"), JSON.stringify(list.map(strip)));
    const out = execFileSync(py, ["run.py", "tickets.json", JSON.stringify(seeds)], { cwd: dir, encoding: "utf8" });
    return JSON.parse(out.trim().split("\n").pop());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function check(label, engineFile) {
  const out = runEngine(engineFile, tickets.hidden, [1, 2]);
  if (out.fatal) throw new Error(`${label}: ${out.fatal}`);
  const report = gradeProject(Object.fromEntries(tickets.hidden.map((t) => [t.id, t.expect])), out.records);
  console.log(`${label}: ${report.score}/${report.total} (${Math.round(report.ratio * 100)}%) ${report.passed ? "PASSES" : "does not pass"}${report.criticalFailed ? ", rule-change email not handed off" : ""}`);
  console.log(`  by requirement: ${report.requirements.map((r) => `${r.id} ${r.passed}/${r.total}`).join("  ")}`);
  if (show)
    for (const r of out.records.filter((x) => x.seed === 1)) {
      const t = report.tickets.find((x) => x.id === r.ticket);
      console.log(`  ${r.ticket} ${t?.ok ? "ok " : "NO "} ${t?.notes.join(",") ?? ""} ${r.error ?? JSON.stringify(r.decision)}`);
    }
  return report;
}

const starter = check("starter ", path.join(SRC, "prompt_engine.py"));
const solution = check("solution", path.join(SRC, "solution", "prompt_engine.py"));

const samples = runEngine(path.join(SRC, "solution", "prompt_engine.py"), tickets.samples, [1]);
const sampleReport = gradeProject(Object.fromEntries(tickets.samples.map((t) => [t.id, t.expect])), samples.records);
console.log(`solution on the samples: ${sampleReport.score}/${sampleReport.total}`);

const problems = [];
if (starter.passed) problems.push("the starter already passes: the project gives the answer away");
if (solution.score !== solution.total) problems.push("the reference solution misses checks: fix it or the tickets");
if (sampleReport.score !== sampleReport.total) problems.push("the reference solution misses sample checks");
if (problems.length) {
  for (const p of problems) console.error(`PROBLEM: ${p}`);
  process.exit(1);
}
console.log("Project OK");
