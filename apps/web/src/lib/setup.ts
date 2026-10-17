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
import type { SkillEvidence } from "@/lib/adaptive-onboarding";

export type QuestionId = "domain" | "role" | "goal" | "experience" | "firstStep" | "style";

export type SetupAnswers = Partial<Record<QuestionId, string | null>> & {
  learningContext?: string;
  learningContextDetail?: string;
  domainOther?: string;
  roleOther?: string;
  /** from "About you" (lib/profiling.ts), in the learner's own words: the finer detail behind the fields above */
  subRole?: string;
  useCase?: string;
  goalDetail?: string;
  /** the learner's name for their own agent (lib/agent-build.ts); a name from their task when unset */
  agentName?: string;
  /** every answer as a tag, e.g. "domain:healthcare", "usecase:billing-and-claims" */
  tags?: string[];
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
      { v: "other", label: "Something else", free: "Your field, like Healthcare" },
    ],
    ifSkipped: "course examples only",
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
      { v: "other", label: "Something else", free: "Your role, like Data analyst" },
    ],
    ifSkipped: "general framing",
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
    ifSkipped: "standard dashboard",
  },
  {
    id: "experience",
    label: "Experience",
    q: "How much have you used this?",
    options: [
      { v: "never", label: "Never" },
      { v: "little", label: "Tried a little" },
      { v: "sometimes", label: "I use it sometimes" },
      { v: "regularly", label: "I use it regularly" },
    ],
    ifSkipped: "standard support until the quick check",
  },
  {
    id: "firstStep",
    label: "Learning start",
    q: "What helps you first with new things?",
    options: [
      { v: "example", label: "See a full example" },
      { v: "idea", label: "Understand the idea" },
      { v: "try", label: "Try it myself" },
    ],
    ifSkipped: "idea first, then example",
  },
  {
    id: "style",
    label: "Explanations",
    q: "How do you like explanations?",
    options: [
      { v: "short", label: "Short and direct" },
      { v: "steps", label: "Step by step" },
    ],
    ifSkipped: "analogies only when you’re stuck",
  },
];

/** The seventh profile question: comfort. Several answers allowed; it changes the app, not the course. */
export const COMFORT_QUESTION = {
  id: "needs" as const,
  label: "Comfort",
  q: "Anything to make this easier?",
  options: [
    { v: "text", label: "Larger text" },
    { v: "motion", label: "Less motion" },
    { v: "none", label: "No, it’s fine" },
  ],
  ifSkipped: "standard text and motion",
};

export function comfortChange(needs: string[] | undefined): { text: string; skipped: boolean } {
  const n = needs ?? [];
  if (!n.length) return { text: `Not set: ${COMFORT_QUESTION.ifSkipped}.`, skipped: true };
  if (n.includes("none")) return { text: "Text and motion stay the same.", skipped: false };
  const parts = [
    n.includes("text") ? "text is larger" : null,
    n.includes("motion") ? "motion is reduced" : null,
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
  /** Reference to server-held artifacts and LLM assessment; never trust client-supplied levels. */
  assessmentId?: string;
  skipped?: boolean;
  isNew?: boolean;
  /** "activity" when the levels came from the Mission or the Discovery conversation instead of the quiz */
  source?: "quiz" | "activity";
  /** the learner-facing profile from the Discovery conversation */
  activity?: {
    summary?: string;
    strengths?: string[];
    focus?: string[];
    evidence?: SkillEvidence[];
    learning?: { firstStep: "example" | "idea" | "try"; style: "short" | "steps"; note: string };
    /** from the Mission: the idea the learner holds for each module (never shown as right or wrong) */
    ideas?: { skill: string; title: string; held: string; accurate: boolean; sure: boolean }[];
  };
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
    return r ? `Module intros and the capstone are framed for ${r}.` : null;
  },
  domain: (a) => {
    const d = domainOf(a);
    return d ? `Each lesson gets an “In your world” card for ${d.label}.` : null;
  },
  goal: (a) =>
    ({
      work: "Your dashboard shows finished modules first, as work skills.",
      ideas: "Your dashboard shows finished modules first.",
      portfolio: "Your dashboard shows your portfolio first.",
      curious: "Your dashboard keeps its usual order.",
    })[a.goal ?? ""] ?? null,
  experience: (a) =>
    ({
      never:
        "Lessons start with extra support and open tips. The quick check can change this.",
      little: "Lessons start on standard support. The quick check adjusts it.",
      sometimes: "Standard support. The quick check lightens what you know.",
      regularly:
        "Lessons start light, with extras folded away. The quick check can change this.",
    })[a.experience ?? ""] ?? null,
  firstStep: (a) =>
    ({
      example: "Lessons go: example, idea, then a quick try.",
      idea: "Lessons go: idea, example, then a quick try.",
      try: "Lessons go: quick try, idea, then example.",
    })[a.firstStep ?? ""] ?? null,
  style: (a) =>
    ({
      short: "Analogies and explanations stay folded, unless you need extra support.",
      steps: "Analogies stay open and each step is explained first.",
    })[a.style ?? ""] ?? null,
};

/** What an answer changes, or what happens when the question is skipped. */
export function changeFor(q: SetupQuestion, a: SetupAnswers): { text: string; skipped: boolean } {
  const text = CHANGE[q.id](a);
  return text ? { text, skipped: false } : { text: `Not set: ${q.ifSkipped}.`, skipped: true };
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
  const support: Support = base.override ?? (source === "ai" ? plan.modules[0]?.support ?? "standard" : score < 0.67 ? "extra" : score > 1.5 ? "light" : "standard");
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

/**
 * What the pre-check set for one lesson: its own result, or its module's when
 * the check asked about the module as a whole (a check item tagged "3" covers
 * every lesson "3.x").
 */
export function precheckSupportFor(a: Adaptation, lesson: string): Support | undefined {
  return a.lessonSupport[lesson] ?? a.lessonSupport[lesson.split(".")[0] ?? ""];
}

/** Support for one lesson: an override wins, then the pre-check, then the overall level. */
export function supportFor(a: Adaptation, lesson: string): Support {
  return a.override ?? precheckSupportFor(a, lesson) ?? a.support;
}

/** Whether the alternative explanation opens by itself in this lesson. */
export function analogyOpenFor(a: Adaptation, lesson: string): boolean {
  const s = supportFor(a, lesson);
  return a.style === "steps" || (s === "extra" && a.style !== "short");
}
