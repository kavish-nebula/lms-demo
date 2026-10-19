/**
 * "About you": six questions, each written live from the questions and
 * answers before it. The first (learning context) has nothing to adapt to, so it is
 * fixed; every later one is written by Gemini (server/profiling.ts) for this
 * learner, so a nurse and an accountant are asked different things. The
 * order of topics (slots) is fixed so the answers always fill the profile.
 * The bank below is the fallback when the model is off or busy.
 *
 * Every answer is saved as a tag, and the tags drive the course:
 *  - domain     → examples, scenarios and projects use cases from that field
 *  - level      → where the course starts
 *  - subrole    → vocabulary and framing (a clinician and an admin hear it differently)
 *  - usecase    → what practice and projects automate
 *  - goal       → the learner's desired outcome in their current studies, life or work
 * Only questions that change the course's content are asked. Format (how a
 * lesson starts) is read from the Discovery chat, and pace is set in Customise.
 * The answers also fill the usual profile fields (domain, role, goal,
 * experience), so adaptation and the planner keep working.
 */
import type { SetupAnswers } from "@/lib/setup";

export type ProfileSlot = "context" | "field" | "experience" | "subrole" | "usecase" | "goal";

export type ProfileOption = {
  label: string;
  /** saved to the profile, e.g. "domain:healthcare" */
  tag: string;
  /** typed answer instead of a fixed label */
  freeText?: boolean;
};

export type ProfileQuestion = {
  slot: ProfileSlot;
  /** a short reaction to the previous answer (live questions only) */
  ack?: string;
  text: string;
  /** one short line on why it's asked, shown under the question */
  why: string;
  options: ProfileOption[];
  source: "ai" | "bank";
};

export type ProfileAnswer = { slot: ProfileSlot; question: string; label: string; tag: string };

/** The topics, in the order they are asked. */
export const SLOTS: ProfileSlot[] = ["context", "field", "experience", "subrole", "usecase", "goal"];
export const QUESTION_COUNT = SLOTS.length;
export const PREFIX: Record<ProfileSlot, string> = { context: "context", field: "domain", experience: "level", subrole: "subrole", usecase: "usecase", goal: "goal" };
/** Slots whose answers map to fixed values; a live question may word them freely but must keep these values. */
export const FIXED_VALUES: Partial<Record<ProfileSlot, string[]>> = {
  experience: ["beginner", "some-exposure", "working-with-it", "advanced"],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "other";
/** "IT or software" → "IT or software", "Healthcare" → "healthcare": lower case that keeps acronyms. */
export const lower = (s: string) => s.split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
const opts = (prefix: string, labels: string[]) => labels.map((label) => ({ label, tag: `${prefix}:${slug(label)}` }));
const other = (slot: ProfileSlot): ProfileOption => ({ label: slot === "field" ? "Other" : "Something else", tag: `${PREFIX[slot]}:other`, freeText: true });

/** The free-text tag for a typed answer. */
export const typedTag = (slot: ProfileSlot, text: string) => `${PREFIX[slot]}:${slug(text)}`;

/* ----------------------------------------------------------------- the fallback bank */

const FIELD_BRANCHES: Record<string, { label: string; roles: string[]; useCases: string[] }> = {
  healthcare: {
    label: "Healthcare",
    roles: ["Clinical (doctor or nurse)", "Hospital administration", "Pharma or lab", "Insurance or billing", "Health-tech"],
    useCases: ["Appointment scheduling", "Patient records and notes", "Billing and claims", "Compliance and reporting"],
  },
  finance: {
    label: "Finance",
    roles: ["Banking", "Accounting", "Investments", "Insurance", "Fintech"],
    useCases: ["Reconciliation", "Invoicing", "Risk reports", "Customer queries"],
  },
  education: {
    label: "Education",
    roles: ["Teaching", "School or college admin", "Corporate training", "Student"],
    useCases: ["Lesson planning", "Attendance and records", "Grading and feedback", "Study help"],
  },
  manufacturing: {
    label: "Manufacturing",
    roles: ["Production and operations", "Quality", "Maintenance", "Supply chain", "Engineering"],
    useCases: ["Production reports", "Quality checks", "Maintenance tickets", "Stock and orders"],
  },
  it: {
    label: "IT or software",
    roles: ["Developer", "QA or testing", "DevOps or IT support", "Product or project lead", "Data"],
    useCases: ["Support tickets", "Code and reviews", "Monitoring and alerts", "Docs and reports"],
  },
  retail: {
    label: "Retail",
    roles: ["Store operations", "E-commerce", "Customer support", "Merchandising", "Owner"],
    useCases: ["Customer questions", "Order tracking", "Stock and inventory", "Sales reports"],
  },
};

/** For a field without its own branch. */
const GENERIC_BRANCH = {
  roles: ["Hands-on or frontline", "Office and admin", "Managing a team", "Technical or IT", "Studying"],
  useCases: ["Writing and documents", "Scheduling and reminders", "Answering questions", "Reports and data"],
};

const fieldOf = (answers: ProfileAnswer[]) => answers.find((a) => a.slot === "field");

/** The first context question and the historical offline fallback. */
export function bankQuestion(slot: ProfileSlot, answers: ProfileAnswer[]): ProfileQuestion {
  const field = fieldOf(answers);
  const branch = FIELD_BRANCHES[field?.tag.split(":")[1] ?? ""];
  const fieldName = lower(branch?.label ?? field?.label ?? "your field");
  const q = (text: string, why: string, options: ProfileOption[]): ProfileQuestion => ({ slot, text, why, options, source: "bank" });
  switch (slot) {
    case "context":
      return q("What best describes you?", "", [
        { label: "School student", tag: "context:school" },
        { label: "College or university student", tag: "context:college" },
        { label: "Teacher or staff", tag: "context:education-staff" },
        { label: "Working professional", tag: "context:workplace" },
        { label: "Learning independently", tag: "context:independent" },
        other("context"),
      ]);
    case "field":
      return q("Which subject or field interests you?", "We’ll use familiar examples.", [
        ...Object.entries(FIELD_BRANCHES).map(([key, b]) => ({ label: b.label, tag: `domain:${key}` })),
        other("field"),
      ]);
    case "experience":
      return q("How familiar are you with this topic?", "", opts("level", ["Beginner", "Some exposure", "Working with it", "Advanced"]));
    case "subrole":
      return q(`What do you study or do in ${fieldName}?`, "", [...opts("subrole", ["Studying this subject", "Teaching or supporting learning", "Applying it at work", "Exploring a personal interest"]), other("subrole")]);
    case "usecase":
      return q("Where would you like to try what you learn?", "", [
        ...opts("usecase", branch?.useCases ?? GENERIC_BRANCH.useCases),
        other("usecase"),
      ]);
    case "goal":
      return q("What would you like to gain from this course?", "", opts("goal", ["Understand the basics", "Apply it in my studies or work", "Build something useful", "Practise with confidence"]));
  }
}

/* ----------------------------------------------------------------- live questions */

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * Checks a question written by the model; null means "use the bank". Fixed
 * slots must keep their values (so "Advanced" still means advanced); open
 * slots get tags from their labels and a "Something else" option.
 */
export function cleanGenerated(slot: ProfileSlot, raw: { ack?: unknown; question?: unknown; why?: unknown; options?: unknown }): ProfileQuestion | null {
  const text = clip(raw.question, 160);
  if (!text || !Array.isArray(raw.options)) return null;
  const fixed = FIXED_VALUES[slot];
  const seen = new Set<string>();
  const options: ProfileOption[] = [];
  for (const o of raw.options as { label?: unknown; value?: unknown }[]) {
    const label = clip(o?.label, 48);
    if (!label || /^(other|something else|none of these)$/i.test(label)) continue; // the screen adds its own
    const value = fixed ? clip(o?.value, 40).toLowerCase() : slug(label);
    if (fixed && !fixed.includes(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ label, tag: `${PREFIX[slot]}:${value}` });
  }
  if (options.length < (fixed ? fixed.length - 1 : 3)) return null;
  return {
    slot,
    ack: clip(raw.ack, 200),
    text,
    why: clip(raw.why, 90) || bankQuestion(slot, []).why,
    options: fixed ? options : [...options.slice(0, 6), other(slot)],
    source: "ai",
  };
}

/* ----------------------------------------------------------------- answers → profile */

const ROLE_MATCH: [string, RegExp][] = [
  ["student", /student|studying|learner/],
  ["manager", /manag|admin|owner|lead|head|director/],
  ["engineer", /developer|engineer|qa|devops|data|tech/],
];
const EXPERIENCE: Record<string, string> = { "level:beginner": "never", "level:some-exposure": "little", "level:working-with-it": "sometimes", "level:advanced": "regularly" };
const GOAL: Record<string, string> = { "goal:get-a-job": "portfolio", "goal:do-my-current-job-better": "work", "goal:build-a-project": "portfolio", "goal:pass-a-certification": "ideas" };

/** All answers → profile fields and the tag list. */
export function profileFromAnswers(answers: ProfileAnswer[]): { setup: SetupAnswers; tags: string[] } {
  const get = (slot: ProfileSlot) => answers.find((a) => a.slot === slot);
  const setup: SetupAnswers = {};
  const context = get("context");
  if (context) {
    setup.learningContext = context.tag.slice("context:".length);
    setup.learningContextDetail = context.label;
  }
  const field = get("field");
  if (field) {
    const key = field.tag.split(":")[1] ?? "other";
    if (key === "manufacturing" || key === "it" || key === "retail" || key === "finance") setup.domain = key;
    else {
      setup.domain = "other";
      setup.domainOther = field.label.slice(0, 80);
    }
  }
  const exp = get("experience");
  if (exp && EXPERIENCE[exp.tag]) setup.experience = EXPERIENCE[exp.tag];
  const sub = get("subrole");
  if (sub) {
    setup.subRole = sub.label.slice(0, 80);
    const hit = ROLE_MATCH.find(([, re]) => re.test(sub.label.toLowerCase()));
    if (hit) setup.role = hit[0];
    else {
      setup.role = "other";
      setup.roleOther = sub.label.slice(0, 80);
    }
  }
  const use = get("usecase");
  if (use) setup.useCase = use.label.slice(0, 80);
  const goal = get("goal");
  if (goal) {
    // Retain historical values for saved profiles; new goals keep their own meaning.
    setup.goal = GOAL[goal.tag] ?? goal.tag.slice("goal:".length);
    setup.goalDetail = goal.label.slice(0, 80);
  }
  const tags = answers.map((a) => a.tag);
  setup.tags = tags;
  return { setup, tags };
}
