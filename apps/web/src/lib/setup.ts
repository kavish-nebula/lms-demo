/**
 * The learner profile: seven questions asked once, at the first enrolment,
 * ported from the prototype's content/profile.js and engine/adaptive.js. Six
 * shape the course; the seventh (comfort) sets text size and motion. Every
 * question is skippable, and every answer drives something the learner can
 * see. Stored as values, never as display text. A short pre-check then sets
 * support lesson by lesson.
 */
import { DOMAINS, ROLES, customDomain, customRole, type Domain } from "@/lib/world";
import type { LearnerPlan, PlanSource } from "@/lib/learner-plan";

export type QuestionId = "domain" | "role" | "goal" | "experience" | "firstStep" | "style";

export type SetupAnswers = Partial<Record<QuestionId, string | null>> & {
  domainOther?: string;
  roleOther?: string;
};

export type SetupOption = { v: string; label: string; free?: string };

export type SetupQuestion = {
  id: QuestionId;
  label: string;
  q: string;
  options: SetupOption[];
  ifSkipped: string;
};

export const QUESTIONS: SetupQuestion[] = [
  {
    id: "domain",
    label: "Field",
    q: "Which field do you work in?",
    options: [
      { v: "manufacturing", label: "Manufacturing" },
      { v: "it", label: "IT services" },
      { v: "retail", label: "Retail / e-commerce" },
      { v: "finance", label: "Finance" },
      { v: "other", label: "Something else", free: "Type your field — e.g. Healthcare" },
    ],
    ifSkipped: "the course’s own examples only",
  },
  {
    id: "role",
    label: "Role",
    q: "What best describes your role?",
    options: [
      { v: "engineer", label: "Engineer / developer" },
      { v: "lead", label: "Team lead" },
      { v: "manager", label: "Manager" },
      { v: "student", label: "Student" },
      { v: "other", label: "Something else", free: "Type your role — e.g. Data analyst" },
    ],
    ifSkipped: "the course’s general framing",
  },
  {
    id: "goal",
    label: "Goal",
    q: "What do you want from this course?",
    options: [
      { v: "work", label: "Use it at work now" },
      { v: "ideas", label: "Understand the ideas" },
      { v: "portfolio", label: "Build a portfolio" },
      { v: "curious", label: "Just curious" },
    ],
    ifSkipped: "the standard dashboard",
  },
  {
    id: "experience",
    label: "Experience with this topic",
    q: "How much have you worked with this topic?",
    options: [
      { v: "never", label: "Never" },
      { v: "little", label: "Tried a little" },
      { v: "sometimes", label: "I use it sometimes" },
      { v: "regularly", label: "I use it regularly" },
    ],
    ifSkipped: "standard support until the quick check measures it",
  },
  {
    id: "firstStep",
    label: "What helps first",
    q: "When something is new, what helps you first?",
    options: [
      { v: "example", label: "See a full example" },
      { v: "idea", label: "Understand the idea" },
      { v: "try", label: "Try it myself first" },
    ],
    ifSkipped: "idea first, then the example",
  },
  {
    id: "style",
    label: "Explanations",
    q: "How do you like explanations?",
    options: [
      { v: "short", label: "Short and direct" },
      { v: "steps", label: "Step by step, with analogies" },
    ],
    ifSkipped: "analogies offered only when a step trips you up",
  },
];

/** The seventh profile question: comfort. Several answers allowed; it changes the app, not the course. */
export const COMFORT_QUESTION = {
  id: "needs" as const,
  label: "Comfort",
  q: "Anything that would make this easier to use?",
  options: [
    { v: "text", label: "Larger text" },
    { v: "motion", label: "Less motion" },
    { v: "none", label: "No, it’s fine as it is" },
  ],
  ifSkipped: "standard text size and motion",
};

export function comfortChange(needs: string[] | undefined): { text: string; skipped: boolean } {
  const n = needs ?? [];
  if (!n.length) return { text: `Not set — ${COMFORT_QUESTION.ifSkipped}.`, skipped: true };
  if (n.includes("none")) return { text: "Text size and motion stay as they are.", skipped: false };
  const parts = [
    n.includes("text") ? "text is one size larger everywhere" : null,
    n.includes("motion") ? "background motion and animations are kept to a minimum" : null,
  ].filter(Boolean);
  const s = parts.join(", and ");
  return { text: s.charAt(0).toUpperCase() + s.slice(1) + ".", skipped: false };
}

export function comfortLabel(needs: string[] | undefined): string | null {
  const n = needs ?? [];
  if (!n.length) return null;
  return n.map((v) => COMFORT_QUESTION.options.find((o) => o.v === v)?.label).filter(Boolean).join(", ");
}

/* ------------------------------------------------------------- support */

export type Support = "extra" | "standard" | "light";

/** Result of the ungraded pre-check: right answers per lesson (0-2). */
export type PrecheckResult = {
  at: string;
  skipped?: boolean;
  isNew?: boolean;
  lessons: Record<string, number>;
  /** the raw answers (null = "I don't know yet"), sent to the server, which scores them and keeps them for planning */
  responses?: Record<string, string | null>;
};

/** "auto" follows the pre-check (or the experience answer); the others apply everywhere. */
export type SupportOverride = "auto" | Support;

export function supportFromExperience(a: SetupAnswers): Support {
  return a.experience === "never" ? "extra" : a.experience === "regularly" ? "light" : "standard";
}

/** Per lesson: 0 right gets extra support, 1 standard, 2 a light touch; "completely new" means extra everywhere. */
export function supportFromPrecheck(p: PrecheckResult | null | undefined): Record<string, Support> {
  if (!p || p.skipped) return {};
  const out: Record<string, Support> = {};
  for (const [lesson, right] of Object.entries(p.lessons)) out[lesson] = p.isNew ? "extra" : right <= 0 ? "extra" : right === 1 ? "standard" : "light";
  return out;
}

/* ------------------------------------------------------------- derived */

export function domainOf(a: SetupAnswers): Domain | null {
  if (!a.domain) return null;
  if (a.domain === "other") return a.domainOther?.trim() ? customDomain(a.domainOther.trim()) : null;
  return DOMAINS[a.domain as keyof typeof DOMAINS] ?? null;
}

export function roleLabelOf(a: SetupAnswers): string | null {
  if (!a.role) return null;
  if (a.role === "other") return a.roleOther?.trim() ? customRole(a.roleOther.trim()) : null;
  return ROLES[a.role as keyof typeof ROLES] ?? null;
}

/** The label a learner picked, for showing an answer back to them. */
export function answerLabel(q: SetupQuestion, a: SetupAnswers): string | null {
  const v = a[q.id];
  if (!v) return null;
  if (v === "other") {
    const typed = q.id === "domain" ? a.domainOther : q.id === "role" ? a.roleOther : undefined;
    if (typed?.trim()) return typed.trim();
  }
  return q.options.find((o) => o.v === v)?.label ?? null;
}

const CHANGE: Record<QuestionId, (a: SetupAnswers) => string | null> = {
  role: (a) => {
    const r = roleLabelOf(a);
    return r ? `The opening of each module and the course capstone brief are framed for ${r}.` : null;
  },
  domain: (a) => {
    const d = domainOf(a);
    return d ? `Every lesson gets an “In your world” card that restates the idea in ${d.label} terms.` : null;
  },
  goal: (a) =>
    ({
      work: "Your dashboard leads with the modules you have completed — each one is a skill you can use at work.",
      ideas: "Your dashboard leads with the modules you have completed.",
      portfolio: "Your dashboard leads with the artifacts in your portfolio.",
      curious: "Your dashboard keeps its usual order — nothing is pushed to the front.",
    })[a.goal ?? ""] ?? null,
  experience: (a) =>
    ({
      never:
        "Every lesson starts with extra support: the analogy and “why” notes are open, and practice has no decoy nodes. The quick check can change this lesson by lesson.",
      little: "Lessons start on standard support. The quick check adjusts it lesson by lesson.",
      sometimes: "Lessons start on standard support. The quick check can lighten the lessons you already know.",
      regularly:
        "Every lesson starts on a light touch: analogy tucked away, narration skippable, build explanations folded — until the quick check says otherwise.",
    })[a.experience ?? ""] ?? null,
  firstStep: (a) =>
    ({
      example: "Each lesson opens with a full example, then the idea, then a quick try.",
      idea: "Each lesson opens with the idea, then a full example, then a quick try.",
      try: "Each lesson opens with a quick try, then the idea, then a full example.",
    })[a.firstStep ?? ""] ?? null,
  style: (a) =>
    ({
      short: "Analogies stay closed and build explanations are folded — except in lessons on extra support.",
      steps: "The analogy is open on every beat and each build step is explained first — except in lessons on a light touch.",
    })[a.style ?? ""] ?? null,
};

/** What an answer changes, or what happens when the question is skipped. */
export function changeFor(q: SetupQuestion, a: SetupAnswers): { text: string; skipped: boolean } {
  const text = CHANGE[q.id](a);
  return text ? { text, skipped: false } : { text: `Not set — ${q.ifSkipped}.`, skipped: true };
}

export type LessonPart = "idea" | "example" | "try";

/** Order of the three parts of a lesson, from "What helps first". */
export function lessonOrder(a: SetupAnswers): LessonPart[] {
  if (a.firstStep === "example") return ["example", "idea", "try"];
  if (a.firstStep === "try") return ["try", "idea", "example"];
  return ["idea", "example", "try"];
}

export type Adaptation = {
  domain: Domain | null;
  roleKey: string | null;
  roleLabel: string | null;
  order: LessonPart[];
  style: string | null;
  analogyOpen: boolean;
  /** overall support: the override, else the pre-check on balance, else the experience answer */
  support: Support;
  /** support per lesson from the pre-check ("1.1" -> "light") */
  lessonSupport: Record<string, Support>;
  supportSource: "override" | "precheck" | "experience" | "plan";
  override: Support | null;
  answered: number;
  /** the server plan this adaptation follows (written by the AI planner, or the rule-based baseline) */
  plan: LearnerPlan | null;
  planSource: PlanSource | null;
};

export function adaptationOf(
  a: SetupAnswers | null | undefined,
  opts: { precheck?: PrecheckResult | null; override?: SupportOverride } = {},
): Adaptation {
  const s = a ?? {};
  const lessonSupport = supportFromPrecheck(opts.precheck);
  const override = opts.override && opts.override !== "auto" ? opts.override : null;
  const levels = Object.values(lessonSupport);
  let support: Support = supportFromExperience(s);
  let supportSource: Adaptation["supportSource"] = "experience";
  if (override) {
    support = override;
    supportSource = "override";
  } else if (levels.length) {
    const score = levels.reduce((n, l) => n + (l === "extra" ? 0 : l === "standard" ? 1 : 2), 0) / levels.length;
    support = score < 0.67 ? "extra" : score > 1.5 ? "light" : "standard";
    supportSource = "precheck";
  }
  return {
    domain: domainOf(s),
    roleKey: s.role ?? null,
    roleLabel: roleLabelOf(s),
    order: lessonOrder(s),
    style: s.style ?? null,
    analogyOpen: s.style === "steps" || (support === "extra" && s.style !== "short"),
    support,
    lessonSupport,
    supportSource,
    override,
    answered: QUESTIONS.filter((q) => !!s[q.id]).length,
    plan: null,
    planSource: null,
  };
}

/**
 * The adaptation a learner's server plan describes: help per lesson from the
 * plan (an override still wins), the rest from their answers as before.
 * Without a plan it is the rule-based adaptation.
 */
export function adaptationFromPlan(
  a: SetupAnswers | null | undefined,
  opts: { precheck?: PrecheckResult | null; override?: SupportOverride },
  plan: LearnerPlan | null | undefined,
  source: PlanSource | null | undefined,
): Adaptation {
  const base = adaptationOf(a, opts);
  if (!plan) return base;
  const lessonSupport: Record<string, Support> = {};
  for (const m of plan.modules) for (const l of m.lessons) lessonSupport[l.lessonId] = l.support;
  const levels = Object.values(lessonSupport);
  const score = levels.reduce<number>((n, l) => n + (l === "extra" ? 0 : l === "standard" ? 1 : 2), 0) / (levels.length || 1);
  const support: Support = base.override ?? (score < 0.67 ? "extra" : score > 1.5 ? "light" : "standard");
  return {
    ...base,
    lessonSupport,
    support,
    supportSource: base.override ? "override" : "plan",
    analogyOpen: base.style === "steps" || (support === "extra" && base.style !== "short"),
    plan,
    planSource: source ?? null,
  };
}

/** Support for one lesson: an override wins, then the pre-check, then the overall level. */
export function supportFor(a: Adaptation, lesson: string): Support {
  return a.override ?? a.lessonSupport[lesson] ?? a.support;
}

/** Whether the alternative explanation opens by itself in this lesson. */
export function analogyOpenFor(a: Adaptation, lesson: string): boolean {
  const s = supportFor(a, lesson);
  return a.style === "steps" || (s === "extra" && a.style !== "short");
}
