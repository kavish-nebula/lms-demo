import { z } from "zod/v4";

export const WORKFLOW_KINDS = ["receive", "guard", "classify", "lookup", "decide", "reply", "handoff"] as const;
export type WorkflowKind = typeof WORKFLOW_KINDS[number];
export const WorkflowSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({ id: z.string().uuid(), kind: z.enum(WORKFLOW_KINDS), label: z.string().trim().min(1).max(100), notes: z.string().max(500), position: z.object({ x: z.number().finite().min(-10000).max(10000), y: z.number().finite().min(-10000).max(10000) }).strict() }).strict()).max(40),
  edges: z.array(z.object({ id: z.string().uuid(), source: z.string().uuid(), target: z.string().uuid(), branch: z.enum(["next", "allowed", "blocked", "found", "missing"]) }).strict()).max(80),
}).strict().superRefine((graph, ctx) => {
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length || new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length) ctx.addIssue({ code: "custom", message: "Every step and connection must have a unique ID." });
  const branches = new Set<string>();
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) ctx.addIssue({ code: "custom", message: "Connections must join two existing, different steps." });
    const key = `${edge.source}:${edge.branch}`;
    if (branches.has(key)) ctx.addIssue({ code: "custom", message: "A step can have only one connection per branch." });
    branches.add(key);
  }
});
export type Workflow = z.infer<typeof WorkflowSchema>;
export const WorkflowSaveSchema = z.object({ diagram: WorkflowSchema, revision: z.number().int().nonnegative() }).strict();
export type WorkflowCheck = "steps" | "connected" | "branches" | "safe" | "order" | "terminates";
export type WorkflowReport = { passed: boolean; checks: { id: WorkflowCheck; passed: boolean }[]; traces: { scenario: "found" | "missing" | "blocked"; steps: string[]; passed: boolean }[]; at: string };
export type WorkflowView = { diagram: Workflow | null; report: WorkflowReport | null; revision: number; updatedAt: string | null };

export function branchesFor(kind: WorkflowKind) {
  return kind === "guard" ? ["allowed", "blocked"] as const : kind === "decide" ? ["found", "missing"] as const : kind === "reply" || kind === "handoff" ? [] : ["next"] as const;
}

/** Checks an architecture exercise; does not grade code or emit course progress. */
export function checkWorkflow(graph: Workflow, at = new Date().toISOString()): WorkflowReport {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const roots = graph.nodes.filter((n) => n.kind === "receive");
  const outgoing = (id: string) => graph.edges.filter((e) => e.source === id);
  const reached = new Set<string>(); const visiting = new Set<string>(); let cycle = false;
  function walk(id: string) {
    if (visiting.has(id)) { cycle = true; return; }
    if (reached.has(id)) return;
    reached.add(id); visiting.add(id); outgoing(id).forEach((e) => walk(e.target)); visiting.delete(id);
  }
  roots.forEach((n) => walk(n.id));
  let safe = true, ordered = true;
  const pathStates = new Set<string>();
  function paths(id: string, guarded: boolean, classified: boolean, looked: boolean, decided: boolean) {
    const key = `${id}:${guarded}:${classified}:${looked}:${decided}`; if (pathStates.has(key)) return; pathStates.add(key);
    const node = byId.get(id); if (!node) return;
    if (["classify", "lookup", "decide", "reply"].includes(node.kind) && !guarded) safe = false;
    if ((node.kind === "lookup" && !classified) || (node.kind === "decide" && !looked) || (node.kind === "reply" && (!looked || !decided))) ordered = false;
    for (const edge of outgoing(id)) paths(edge.target, guarded || (node.kind === "guard" && edge.branch === "allowed"), classified || node.kind === "classify", looked || node.kind === "lookup",decided || node.kind === "decide");
  }
  roots.forEach((n) => paths(n.id, false, false,false,false));
  const traces = (["found", "missing", "blocked"] as const).map((scenario) => {
    const steps: string[] = []; let node = roots[0]; let passed = false;
    for (let i = 0; node && i <= graph.nodes.length; i++) {
      steps.push(node.id);
      if (node.kind === "reply" || node.kind === "handoff") { passed = node.kind === (scenario === "found" ? "reply" : "handoff"); break; }
      const branch = node.kind === "guard" ? scenario === "blocked" ? "blocked" : "allowed" : node.kind === "decide" ? scenario === "found" ? "found" : "missing" : "next";
      node = byId.get(outgoing(node.id).find((e) => e.branch === branch)?.target ?? "")!;
    }
    return { scenario, steps, passed };
  });
  const checks = [
    { id: "steps" as const, passed: roots.length === 1 && WORKFLOW_KINDS.every((kind) => graph.nodes.some((n) => n.kind === kind)) },
    { id: "connected" as const, passed: roots.length === 1 && reached.size === graph.nodes.length && !graph.edges.some((e) => e.target === roots[0]?.id) },
    { id: "branches" as const, passed: graph.nodes.every((n) => { const expected = branchesFor(n.kind); const edges = outgoing(n.id); return edges.length === expected.length && expected.every((b) => edges.some((e) => e.branch === b)); }) },
    { id: "safe" as const, passed: safe && traces.find((x) => x.scenario === "blocked")!.passed && !traces.find((x) => x.scenario === "blocked")!.steps.some((id) => byId.get(id)?.kind === "lookup") },
    { id: "order" as const, passed: ordered && traces.every((x) => x.passed) && traces.filter((x) => x.scenario !== "blocked").every((x) => ["classify", "lookup", "decide"].every((kind) => x.steps.some((id) => byId.get(id)?.kind === kind))) },
    { id: "terminates" as const, passed: !cycle && graph.nodes.length > 0 && graph.nodes.filter((n) => !outgoing(n.id).length).every((n) => n.kind === "reply" || n.kind === "handoff") },
  ];
  return { checks, traces, passed: checks.every((x) => x.passed), at };
}
