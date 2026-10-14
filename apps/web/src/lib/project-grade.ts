/**
 * Grades the mini project's runs. Shared: the server grades the hidden
 * tickets (their expectations never reach the browser), the workspace grades
 * the sample tickets, and fixtures/scripts/check-project.mjs checks the
 * starter and the reference solution. No imports, so Node can run it as is.
 */

export type ProjectTicket = { id: string; from: string; subject: string; body: string };

export type TicketExpect = {
  intent: string | string[];
  order_id: string | null;
  email: string | null;
  action: "reply" | "ask_for_order" | "handoff";
  /** every phrase must appear in the reply (any case) */
  include?: string[];
  /** no phrase may appear in the reply */
  exclude?: string[];
  /** failing this ticket fails the project, whatever the score */
  critical?: boolean;
};

/** One ticket run through the learner's engine (from run.py). */
export type RunRecord = {
  ticket: string;
  seed: number;
  step: string;
  decision?: unknown;
  error?: string;
  where?: string | null;
};

export type RequirementId = "r1" | "r2" | "r3" | "r4" | "r5" | "r6" | "r7";

export type ProjectReport = {
  score: number;
  total: number;
  ratio: number;
  passed: boolean;
  /** a critical ticket (the one that tries to change Scout's rules) went wrong */
  criticalFailed: boolean;
  requirements: { id: RequirementId; passed: number; total: number }[];
  tickets: { id: string; ok: boolean; notes: RequirementId[]; error?: string }[];
  /** requirements below 80%, weakest first */
  weak: RequirementId[];
};

export const INTENTS = ["order_status", "return", "exchange", "policy_question", "other"];
export const ACTIONS = ["reply", "ask_for_order", "handoff"];
export const PASS_RATIO = 0.8;

/**
 * The requirements, in the brief's order, and the lesson each one practises
 * (a weak requirement adds help to that lesson in the learner's plan).
 */
export const REQUIREMENT_LESSON: Record<RequirementId, string> = {
  r1: "2.5", // structured output
  r2: "2.3", // the right intent
  r3: "2.3", // the right details
  r4: "4.3", // grounded in the policy
  r5: "6.1", // routed safely
  r6: "2.5", // stable from run to run (an output schema fixes the format)
  r7: "2.4", // sounds like Scout
};

type Decision = { intent: string; order_id: string | null; email: string | null; reply: string; action: string };

function asDecision(v: unknown): Decision | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  return {
    intent: str(d.intent) ?? "",
    order_id: str(d.order_id),
    email: str(d.email),
    reply: str(d.reply) ?? "",
    action: str(d.action) ?? "",
  };
}

const same = (a: string | null, b: string | null, fold: (s: string) => string) => (a ? fold(a.trim()) : null) === (b ? fold(b) : null);
const GENERIC = /\bas an ai\b|\blanguage model\b/i;

/**
 * One check per requirement per ticket (r6 compares the two runs). A
 * requirement a ticket doesn't test, such as the policy check on a ticket
 * with no phrases to look for, isn't counted for it.
 */
export function gradeProject(expect: Record<string, TicketExpect>, records: RunRecord[]): ProjectReport {
  const req = new Map<RequirementId, { passed: number; total: number }>(
    (Object.keys(REQUIREMENT_LESSON) as RequirementId[]).map((id) => [id, { passed: 0, total: 0 }]),
  );
  const tally = (id: RequirementId, ok: boolean) => {
    const r = req.get(id)!;
    r.total++;
    if (ok) r.passed++;
    return ok;
  };
  const tickets: ProjectReport["tickets"] = [];
  let criticalFailed = false;

  for (const [id, e] of Object.entries(expect)) {
    const runs = records.filter((r) => r.ticket === id).sort((a, b) => a.seed - b.seed);
    const first = runs[0];
    const d = asDecision(first?.decision);
    const notes: RequirementId[] = [];
    const check = (rid: RequirementId, ok: boolean) => {
      if (!tally(rid, ok)) notes.push(rid);
    };

    check("r1", !!d && INTENTS.includes(d.intent) && ACTIONS.includes(d.action) && !!d.reply.trim());
    check("r2", !!d && (Array.isArray(e.intent) ? e.intent : [e.intent]).includes(d.intent));
    check("r3", !!d && same(d.order_id, e.order_id, (s) => s.toUpperCase()) && same(d.email, e.email, (s) => s.toLowerCase()));
    if (e.include?.length || e.exclude?.length) {
      const reply = d?.reply.toLowerCase() ?? "";
      check("r4", !!d && (e.include ?? []).every((p) => reply.includes(p.toLowerCase())) && !(e.exclude ?? []).some((p) => reply.includes(p.toLowerCase())));
    }
    check("r5", !!d && d.action === e.action);
    if (runs.length > 1) {
      const key = (r: RunRecord) => {
        const x = asDecision(r.decision);
        return x ? JSON.stringify([x.intent, x.order_id?.toUpperCase() ?? null, x.email?.toLowerCase() ?? null, x.action]) : "error";
      };
      check("r6", runs.every((r) => key(r) !== "error" && key(r) === key(runs[0]!)));
    }
    check("r7", !!d && !!d.reply.trim() && !GENERIC.test(d.reply));

    if (e.critical && notes.some((n) => n === "r5" || n === "r4")) criticalFailed = true;
    tickets.push({ id, ok: notes.length === 0, notes, ...(first?.error ? { error: first.error } : {}) });
  }

  const requirements = [...req.entries()].map(([id, r]) => ({ id, ...r })).filter((r) => r.total > 0);
  const score = requirements.reduce((n, r) => n + r.passed, 0);
  const total = requirements.reduce((n, r) => n + r.total, 0);
  const ratio = total ? score / total : 0;
  const weak = requirements
    .filter((r) => r.passed / r.total < PASS_RATIO)
    .sort((a, b) => a.passed / a.total - b.passed / b.total)
    .map((r) => r.id);
  return { score, total, ratio, passed: ratio >= PASS_RATIO && !criticalFailed, criticalFailed, requirements, tickets, weak };
}
