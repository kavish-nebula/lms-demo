/**
 * The learner profile, asked once at the first enrolment. It starts from the
 * learner's field, and the field decides what comes next: someone at work is
 * asked about their role, the systems they use and the first job they would
 * hand to an agent (a pack per field, lib/profiling/packs.ts); a student is
 * asked what and where they study. Everyone then answers the questions about
 * this topic and how they like to learn, plus comfort, which sets text size
 * and motion. Every question is skippable, and every answer drives something
 * the learner can see.
 *
 * Answers are stored as values, never as display text. Moving to another
 * branch leaves old answers behind; normalizeAnswers() drops them (and any
 * value that is not an option), both in the browser and on the server, so a
 * stale answer never reaches the planner. Help per lesson then follows the
 * learner's answers inside lessons (an older enrollment may also carry a
 * quick-check result, which still counts).
 */
import { DOMAINS, ROLES, customDomain, customRole, studentDomain, type Domain } from "@/lib/world";
import { COMMON_ROLES, GENERAL_JOBS, GENERAL_ROLES, GENERAL_WORK_ROLES, PACKS, packOf, type FieldId, type PackOption, type RoleKey } from "@/lib/profiling/packs";
import { derivedFor, type ProfileDerived } from "@/lib/profiling/derived";
import type { LearnerPlan, PlanSource } from "@/lib/learner-plan";

export type QuestionId =
  | "domain"
  | "role"
  | "years"
  | "tools"
  | "firstJob"
  | "studyLevel"
  | "studyField"
  | "project"
  | "goal"
  | "experience"
  | "coding"
  | "firstStep"
  | "style";

export type FreeKey = "domainOther" | "roleOther" | "studyFieldOther" | "firstJobOther";

/** One exchange of the "About you" interview, as asked and answered (the answer as the learner gave it). */
export type InterviewTurn = { slot: string; q: string; a: string };

export type SetupAnswers = Partial<Record<Exclude<QuestionId, "tools">, string | null>> & {
  /** the one question that takes several answers */
  tools?: string[] | null;
  domainOther?: string;
  roleOther?: string;
  studyFieldOther?: string;
  /** the field pack a typed field was matched to (server/profiling): its questions follow */
  field?: FieldId;
  /** answers to the model's follow-up questions, by follow-up id */
  extra?: Record<string, string>;
  /** a typed first job for an agent ("firstJob" = "other") */
  firstJobOther?: string;
  /** for a role in the learner's own words ("role" = "other"): which of the course's role texts fits */
  roleKind?: RoleKey;
  /** the interview as it happened: Pip's questions in Pip's words, the learner's answers in theirs */
  interview?: InterviewTurn[];
  /* ---- per course, asked when enrolling (kept with the enrollment, never in the profile) ---- */
  /** modules of this course they already know (module ids) */
  known?: string[];
  /** what they want this course to focus on, or skip, in their words */
  expect?: string;
  /** the course questions as they happened */
  courseInterview?: InterviewTurn[];
};

/** Answers that belong to one course (asked when enrolling), not to the learner's profile. */
export const COURSE_KEYS = ["goal", "experience", "firstJob", "firstJobOther", "known", "expect", "courseInterview"] as const;

/** The profile part of a set of answers: course-specific ones left out. */
export function profilePart(a: SetupAnswers): SetupAnswers {
  const out = { ...a } as Record<string, unknown>;
  for (const k of COURSE_KEYS) delete out[k];
  return out as SetupAnswers;
}

/** The course part of a set of answers: only the ones asked when enrolling. */
export function coursePart(a: SetupAnswers): SetupAnswers {
  const out: Record<string, unknown> = {};
  for (const k of COURSE_KEYS) if (a[k] !== undefined) out[k] = a[k];
  return out as SetupAnswers;
}

/** A bank question, or one of the model's follow-ups (`fu:<id>`). */
export type QuestionKey = QuestionId | `fu:${string}`;

export type SetupOption = PackOption;

/** Fixed, or worked out from the answers so far and (for a typed field) the model's reading of it. */
type ByAnswers<T> = T | ((a: SetupAnswers, d?: ProfileDerived | null) => T);

type BankQuestion = {
  id: QuestionId;
  label: string;
  q: ByAnswers<string>;
  options: ByAnswers<SetupOption[]>;
  multi?: boolean;
  /** asked only when this holds for the answers before it */
  when?: (a: SetupAnswers) => boolean;
  /** when an earlier answer already says it, the question is skipped and this value used */
  infer?: (a: SetupAnswers) => string | undefined;
  /** where the typed text of a "Something else" answer is kept */
  freeKey?: FreeKey;
  /** values that are no longer offered but still valid in saved answers */
  legacy?: (a: SetupAnswers) => SetupOption[];
  note?: (a: SetupAnswers) => string | undefined;
  ifSkipped: string;
};

/** A question as one learner sees it: wording and options worked out from their answers. */
export type SetupQuestion = Omit<BankQuestion, "id" | "q" | "options" | "note"> & {
  id: QuestionKey;
  q: string;
  options: SetupOption[];
  note?: string;
  /** a follow-up's answer lives in `answers.extra[extraKey]` */
  extraKey?: string;
};

/** The pack whose questions apply: the chosen field's, or the one a typed field was matched to. */
const packFor = (a: SetupAnswers) => packOf(a.domain === "other" ? a.field : a.domain);

const isStudent = (a: SetupAnswers) => a.domain === "student";
const atWork = (a: SetupAnswers) => !!a.domain && !isStudent(a);
const resolve = <T,>(v: ByAnswers<T>, a: SetupAnswers, d?: ProfileDerived | null): T =>
  typeof v === "function" ? (v as (a: SetupAnswers, d?: ProfileDerived | null) => T)(a, d) : v;

const STUDY_LEVELS: SetupOption[] = [
  { v: "school", label: "School", who: "a school student" },
  { v: "undergrad", label: "Undergraduate", who: "an undergraduate" },
  { v: "postgrad", label: "Postgraduate", who: "a postgraduate student" },
  { v: "graduate", label: "Recently graduated", who: "a recent graduate" },
  { v: "self", label: "Learning on my own", who: "a self-taught learner" },
];

const STUDY_FIELDS: SetupOption[] = [
  { v: "cs", label: "Computer science / IT" },
  { v: "engineering", label: "Engineering" },
  { v: "business", label: "Business" },
  { v: "science", label: "Science" },
  { v: "arts", label: "Arts & humanities" },
  { v: "other", label: "Something else", free: "Type your subject — e.g. Psychology" },
];

const WORK_GOALS: SetupOption[] = [
  { v: "work", label: "Use it at work now" },
  { v: "ideas", label: "Understand the ideas" },
  { v: "portfolio", label: "Build a portfolio" },
  { v: "curious", label: "Just curious" },
];

const STUDENT_GOALS: SetupOption[] = [
  { v: "studies", label: "Do well in my studies" },
  { v: "portfolio", label: "Build a portfolio project" },
  { v: "career", label: "Get ready for an internship or job" },
  { v: "curious", label: "Just curious" },
];

/** Roles for the learner's field: its pack, or the general list for a typed or skipped field. */
/**
 * Roles for the learner's field: its pack's; for a typed field with no pack,
 * the roles the model wrote for it (then lead, manager, something else), or
 * a work-only general list; for a skipped field, the general list.
 */
function rolesFor(a: SetupAnswers, d?: ProfileDerived | null): SetupOption[] {
  const pack = packFor(a);
  if (pack) return pack.roles;
  if (a.domain !== "other") return GENERAL_ROLES;
  const own = derivedFor(a, d)?.roles ?? [];
  if (!own.length) return GENERAL_WORK_ROLES;
  const taken = new Set(own.map((o) => o.label.toLowerCase()));
  return [...own.map((o) => ({ ...o, who: customRole(o.label.toLowerCase()) })), ...COMMON_ROLES.filter((o) => !taken.has(o.label.toLowerCase()))];
}

/** First jobs for an agent: the pack's, the model's for a typed field, or the general list. */
function firstJobsFor(a: SetupAnswers, d?: ProfileDerived | null): SetupOption[] {
  const own = derivedFor(a, d)?.firstJobs ?? [];
  const jobs = packFor(a)?.firstJobs ?? (own.length ? own : GENERAL_JOBS);
  return [...jobs, { v: "other", label: "Something else", free: "Type the job — e.g. Answering supplier emails" }];
}

/** Whether the learner works with code or systems day to day, which changes how the coding question is worded. */
function technical(a: SetupAnswers, d?: ProfileDerived | null): boolean {
  const role = rolesFor(a, d).find((o) => o.v === a.role) ?? GENERAL_ROLES.find((o) => o.v === a.role);
  return role?.as === "engineer" || a.studyField === "cs" || a.domain === "it" || a.field === "it";
}

export const QUESTION_BANK: BankQuestion[] = [
  {
    id: "domain",
    label: "Field",
    q: "Which field have you worked in?",
    options: [
      { v: "it", label: "IT & software" },
      { v: "manufacturing", label: "Manufacturing" },
      { v: "retail", label: "Retail & e-commerce" },
      { v: "finance", label: "Finance" },
      { v: "healthcare", label: "Healthcare" },
      { v: "education", label: "Education" },
      { v: "student", label: "I’m a student / no work experience yet" },
      { v: "other", label: "Something else", free: "Type your field — e.g. Logistics" },
    ],
    freeKey: "domainOther",
    ifSkipped: "the course’s own examples only",
  },
  /* -------- at work: the field's pack -------- */
  {
    id: "role",
    label: "Role",
    q: (a) => (packFor(a) ? "What do you do there?" : "What best describes your role?"),
    options: rolesFor,
    when: (a) => !isStudent(a),
    // the roles the course offered before fields had packs, and the work-only list, stay valid in saved answers
    legacy: () => [...GENERAL_ROLES, ...GENERAL_WORK_ROLES],
    freeKey: "roleOther",
    ifSkipped: "the course’s general framing",
  },
  {
    id: "years",
    label: "Years in your field",
    q: "How long have you worked in this field?",
    options: [
      { v: "lt1", label: "Less than a year" },
      { v: "1-3", label: "1–3 years" },
      { v: "4-7", label: "4–7 years" },
      { v: "8plus", label: "8 years or more" },
    ],
    when: atWork,
    ifSkipped: "examples pitched for someone new to the field",
  },
  {
    id: "tools",
    label: "Tools you use",
    q: "Which of these do you use at work?",
    options: (a) => packFor(a)?.tools ?? [],
    multi: true,
    when: (a) => !!packFor(a),
    note: (a) => packFor(a)?.note,
    ifSkipped: "examples that name no particular system",
  },
  {
    id: "firstJob",
    label: "First job for an agent",
    q: "Which job would you hand to an AI agent first?",
    options: firstJobsFor,
    when: atWork,
    freeKey: "firstJobOther",
    ifSkipped: "the course’s own capstone story",
  },
  /* -------- students -------- */
  {
    id: "studyLevel",
    label: "Studies",
    q: "Where are you in your studies?",
    options: STUDY_LEVELS,
    when: isStudent,
    ifSkipped: "framing for a student at any level",
  },
  {
    id: "studyField",
    label: "Subject",
    q: "What do you study, or want to?",
    options: STUDY_FIELDS,
    when: isStudent,
    freeKey: "studyFieldOther",
    ifSkipped: "the course’s own examples only",
  },
  {
    id: "project",
    label: "Projects so far",
    q: "Have you built a project of your own before?",
    options: [
      { v: "none", label: "Not yet" },
      { v: "exercises", label: "Class exercises" },
      { v: "own", label: "My own project" },
    ],
    when: isStudent,
    ifSkipped: "help on build lessons set by your answers in lessons",
  },
  /* -------- everyone -------- */
  {
    id: "goal",
    label: "Goal",
    q: "What do you want from this course?",
    options: (a) => (isStudent(a) ? STUDENT_GOALS : WORK_GOALS),
    ifSkipped: "the standard dashboard",
  },
  {
    id: "experience",
    label: "Experience with this topic",
    q: "How much have you worked with AI agents?",
    options: [
      { v: "never", label: "Never" },
      { v: "little", label: "Tried a little" },
      { v: "sometimes", label: "I use them sometimes" },
      { v: "regularly", label: "I use them regularly" },
    ],
    ifSkipped: "standard support, adjusted by your answers in lessons",
  },
  {
    id: "coding",
    label: "Coding",
    q: (a, d) => (technical(a, d) ? "How much code have you written?" : "Have you ever written code or scripts?"),
    options: [
      { v: "none", label: "Not yet" },
      { v: "little", label: "A little: exercises or small scripts" },
      { v: "python", label: "Python, regularly" },
      { v: "otherlang", label: "Another language, regularly" },
    ],
    // naming Python among the tools already answers this
    infer: (a) => (a.tools?.includes("python") ? "python" : undefined),
    ifSkipped: "help on code lessons set by your answers in lessons",
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

const bankById = new Map(QUESTION_BANK.map((q) => [q.id, q]));

function resolveQuestion(q: BankQuestion, a: SetupAnswers, d?: ProfileDerived | null): SetupQuestion {
  return { ...q, q: resolve(q.q, a, d), options: resolve(q.options, a, d), note: q.note?.(a) };
}

type Walk = { answers: SetupAnswers; asked: SetupQuestion[]; inferred: SetupQuestion[] };

/** The model's follow-ups as questions; their answers are kept in `answers.extra`. */
function followUpQuestions(d: ProfileDerived): SetupQuestion[] {
  return d.followUps.map((f) => ({ id: `fu:${f.id}` as const, label: "About your work", q: f.q, options: f.options, extraKey: f.id, ifSkipped: "Pip’s general examples" }));
}

/**
 * Goes through the bank in order, deciding each question from the answers kept
 * so far: hidden ones are dropped, implied ones filled in, the rest asked.
 * Only valid answers are kept, so a later question never branches on a stale one.
 * With the model's result for a typed field (`d`), that field's pack is used
 * and its follow-ups are asked just before the goal.
 */
function walk(raw: SetupAnswers | null | undefined, d?: ProfileDerived | null): Walk {
  const a = raw ?? {};
  const out: SetupAnswers = {};
  const asked: SetupQuestion[] = [];
  const inferred: SetupQuestion[] = [];
  const keep = out as Record<string, unknown>;
  for (const bq of QUESTION_BANK) {
    // the field is settled once the first question is: match a typed one to its pack
    if (bq.id === "role") {
      const match = derivedFor(out, d);
      if (match?.field && match.field in PACKS) out.field = match.field;
    }
    if (bq.id === "goal") {
      const match = derivedFor(out, d);
      for (const q of match ? followUpQuestions(match) : []) {
        asked.push(q);
        const v = a.extra?.[q.extraKey!];
        if (v && q.options.some((o) => o.v === v)) out.extra = { ...out.extra, [q.extraKey!]: v };
      }
    }
    if (bq.when && !bq.when(out)) continue;
    const q = resolveQuestion(bq, out, d);
    const implied = bq.infer?.(out);
    if (implied) {
      keep[q.id] = implied;
      inferred.push(q);
      continue;
    }
    asked.push(q);
    const valid = new Set([...q.options, ...(bq.legacy?.(out) ?? [])].map((o) => o.v));
    if (q.multi) {
      const picked = (Array.isArray(a.tools) ? a.tools : []).filter((v, i, all) => valid.has(v) && all.indexOf(v) === i);
      // "None of these" stands alone
      const value = picked.includes("none") ? ["none"] : picked;
      if (value.length) keep[q.id] = value;
      continue;
    }
    const v = (a as Record<string, unknown>)[q.id];
    if (typeof v !== "string" || !valid.has(v)) continue;
    keep[q.id] = v;
    if (v === "other" && q.freeKey) {
      const typed = a[q.freeKey]?.trim().slice(0, 80);
      if (typed) out[q.freeKey] = typed;
    }
  }
  // a role in the learner's own words keeps the role texts it was matched to
  const kinds: RoleKey[] = ["engineer", "lead", "manager", "student", "other"];
  if (out.role === "other" && a.roleKind && kinds.includes(a.roleKind)) out.roleKind = a.roleKind;
  // the interview transcripts are kept as they happened (they only inform the planner)
  const transcript = (list: unknown) =>
    Array.isArray(list)
      ? (list as InterviewTurn[])
          .filter((t) => t && typeof t.slot === "string" && typeof t.q === "string" && typeof t.a === "string")
          .slice(0, 16)
          .map((t) => ({ slot: t.slot.slice(0, 20), q: t.q.slice(0, 200), a: t.a.slice(0, 160) }))
      : undefined;
  if (a.interview) out.interview = transcript(a.interview);
  if (a.courseInterview) out.courseInterview = transcript(a.courseInterview);
  // per course: modules they know, what they want from it
  if (Array.isArray(a.known)) out.known = [...new Set(a.known.filter((k) => typeof k === "string" && /^[\w-]{1,12}$/.test(k)))].slice(0, 20);
  if (typeof a.expect === "string" && a.expect.trim()) out.expect = a.expect.trim().slice(0, 200);
  return { answers: out, asked, inferred };
}

/** The questions to ask this learner, in order, as their answers stand now. */
export function questionsFor(a: SetupAnswers | null | undefined, d?: ProfileDerived | null): SetupQuestion[] {
  return walk(a, d).asked;
}

/**
 * The answers that still apply: other branches' answers and invalid values
 * dropped, implied ones filled in. Pass the model's result for a typed field
 * where it is known, or the pack match and follow-up answers are dropped too.
 */
export function normalizeAnswers(a: SetupAnswers | null | undefined, d?: ProfileDerived | null): SetupAnswers {
  return walk(a, d).answers;
}

/** One question by id, worded for these answers (for screens that show a single setting, such as lesson order). */
export function questionById(id: QuestionId, a: SetupAnswers = {}, d?: ProfileDerived | null): SetupQuestion {
  return resolveQuestion(bankById.get(id)!, a, d);
}

/** Every answer that applies, asked or implied, as label and text: what the planner and summaries show. */
export function profileLines(a: SetupAnswers | null | undefined, d?: ProfileDerived | null): { id: QuestionKey; label: string; answer: string | null }[] {
  const w = walk(a, d);
  // follow-ups sit just before the goal, as they are asked
  const rank = (id: QuestionKey) => (id.startsWith("fu:") ? QUESTION_BANK.findIndex((q) => q.id === "goal") - 0.5 : QUESTION_BANK.findIndex((q) => q.id === id));
  return [...w.asked, ...w.inferred]
    .sort((x, y) => rank(x.id) - rank(y.id))
    .map((q) => ({ id: q.id, label: q.extraKey ? q.q : q.label, answer: answerLabel(q, w.answers) }));
}

/** An interview as "question answer" lines, for the planner: the profile one, or the course one. */
export function interviewLines(a: SetupAnswers | null | undefined, which: "interview" | "courseInterview" = "interview"): string[] {
  return (a?.[which] ?? []).map((t) => `- ${t.q} ${t.a}`);
}

/** A question's current answer value (a follow-up's lives in `extra`). */
export function valueOf(q: SetupQuestion, a: SetupAnswers): string | null {
  const v = q.extraKey ? a.extra?.[q.extraKey] : (a as Record<string, unknown>)[q.id];
  return typeof v === "string" ? v : null;
}

/** The answers with one question set (null clears it). */
export function withAnswer(q: SetupQuestion, a: SetupAnswers, v: string | null): SetupAnswers {
  if (!q.extraKey) return { ...a, [q.id]: v };
  const extra = { ...a.extra };
  if (v === null) delete extra[q.extraKey];
  else extra[q.extraKey] = v;
  return { ...a, extra };
}

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

/** Help on lessons with code, from the coding answer: none starts them on extra, regular Python on a light touch. */
export function supportFromCoding(a: SetupAnswers): Support | null {
  return a.coding === "none" ? "extra" : a.coding === "python" ? "light" : null;
}

/* ------------------------------------------------------------- derived */

const optionOf = (q: QuestionId, a: SetupAnswers, d?: ProfileDerived | null) => {
  const v = (a as Record<string, unknown>)[q];
  const bq = bankById.get(q)!;
  return [...resolve(bq.options, a, d), ...(bq.legacy?.(a) ?? [])].find((o) => o.v === v);
};

export function domainOf(a: SetupAnswers, d?: ProfileDerived | null): Domain | null {
  if (!a.domain) return null;
  if (a.domain === "student") {
    if (a.studyField === "other") return a.studyFieldOther?.trim() ? studentDomain(a.studyFieldOther.trim()) : studentDomain("your studies");
    return studentDomain(optionOf("studyField", a)?.label ?? "your studies");
  }
  if (a.domain === "other") {
    // the model's nouns for this field, when it supplied them
    const vocab = derivedFor(a, d)?.vocab;
    if (vocab) return { ...vocab, label: a.domainOther!.trim() };
    return a.domainOther?.trim() ? customDomain(a.domainOther.trim()) : null;
  }
  return DOMAINS[a.domain as keyof typeof DOMAINS] ?? null;
}

/** Which of the course's role texts (opening scenes, capstone brief) fits this learner. */
export function roleKeyOf(a: SetupAnswers, d?: ProfileDerived | null): RoleKey | null {
  if (a.domain === "student") return "student";
  if (!a.role) return null;
  if (a.role === "other" && a.roleKind) return a.roleKind;
  return optionOf("role", a, d)?.as ?? (a.role in ROLES ? (a.role as RoleKey) : "other");
}

export function roleLabelOf(a: SetupAnswers, d?: ProfileDerived | null): string | null {
  if (a.domain === "student") return optionOf("studyLevel", a)?.who ?? ROLES.student;
  if (!a.role) return null;
  if (a.role === "other") return a.roleOther?.trim() ? customRole(a.roleOther.trim()) : null;
  return optionOf("role", a, d)?.who ?? ROLES[a.role as keyof typeof ROLES] ?? null;
}

/** The label a learner picked, for showing an answer back to them. */
export function answerLabel(q: SetupQuestion, a: SetupAnswers): string | null {
  if (q.multi) {
    const picked = (a.tools ?? []).map((v) => q.options.find((o) => o.v === v)?.label).filter(Boolean);
    return picked.length ? picked.join(", ") : null;
  }
  if (q.extraKey) return q.options.find((o) => o.v === a.extra?.[q.extraKey!])?.label ?? null;
  const v = (a as Record<string, unknown>)[q.id];
  if (typeof v !== "string" || !v) return null;
  if (v === "other" && q.freeKey) {
    const typed = a[q.freeKey];
    if (typed?.trim()) return typed.trim();
  }
  return optionOf(q.id as QuestionId, a)?.label ?? q.options.find((o) => o.v === v)?.label ?? null;
}

const lower = (s: string | null | undefined) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");

const CHANGE: Record<QuestionId, (a: SetupAnswers, d?: ProfileDerived | null) => string | null> = {
  domain: (a) => {
    const d = domainOf(a);
    if (a.domain === "student") return "Every lesson gets an “In your world” card set in your coursework, and the questions turn to your studies.";
    return d ? `Every lesson gets an “In your world” card that restates the idea in ${d.label} terms.` : null;
  },
  role: (a, d) => {
    const r = roleLabelOf(a, d);
    return r ? `The opening of each module and the course capstone brief are framed for ${r}.` : null;
  },
  years: (a) => {
    const y = optionOf("years", a)?.label;
    return y ? `Your plan pitches its examples for someone with ${lower(y)} in the field.` : null;
  },
  tools: (a) => {
    const picked = (a.tools ?? []).filter((v) => v !== "none");
    if (a.tools?.includes("none")) return "Examples stay general rather than naming a system.";
    const labels = picked.map((v) => questionById("tools", a).options.find((o) => o.v === v)?.label).filter(Boolean);
    return labels.length ? `Your plan’s examples can mention the systems you use: ${labels.join(", ")}.` : null;
  },
  firstJob: (a, d) => {
    const j = optionOf("firstJob", a, d)?.label;
    return j ? `Your capstone brief is framed around ${lower(j)}.` : null;
  },
  studyLevel: (a) => {
    const w = optionOf("studyLevel", a)?.who;
    return w ? `The opening of each module and the capstone brief are framed for ${w}.` : null;
  },
  studyField: (a) => (a.studyField ? `“In your world” cards use coursework in ${domainOf(a)?.label ?? "your subject"}.` : null),
  project: (a) =>
    ({
      none: "Your plan knows this will be your first build.",
      exercises: "Your plan knows you have done class exercises, but no project of your own yet.",
      own: "Your plan knows you have built a project of your own before.",
    })[a.project ?? ""] ?? null,
  goal: (a) =>
    ({
      work: "Your dashboard leads with the modules you have completed — each one is a skill you can use at work.",
      ideas: "Your dashboard leads with the modules you have completed.",
      portfolio: "Your dashboard leads with the artifacts in your portfolio.",
      curious: "Your dashboard keeps its usual order — nothing is pushed to the front.",
      studies: "Your plan gives more attention to the modules that build understanding.",
      career: "Your plan gives more attention to the build modules, the ones you would show in an interview.",
    })[a.goal ?? ""] ?? null,
  experience: (a) =>
    ({
      never:
        "Every lesson starts with extra support: the analogy and “why” notes are open, and the “Stuck?” tips in guided practice start open. Your answers in lessons can change this module by module.",
      little: "Lessons start on standard support. Your answers in lessons adjust it lesson by lesson.",
      sometimes: "Lessons start on standard support. Your answers in lessons can lighten the ones you already know.",
      regularly:
        "Every lesson starts on a light touch: analogy tucked away, narration skippable, build explanations folded — until your answers in lessons say otherwise.",
    })[a.experience ?? ""] ?? null,
  coding: (a) =>
    ({
      none: "Lessons with code start with extra help, until your answers in lessons say otherwise.",
      little: "Lessons with code start on standard help.",
      python: "Lessons with code start on a light touch: you already write Python.",
      otherlang: "Lessons with code start on standard help.",
    })[a.coding ?? ""] ?? null,
  firstStep: (a) =>
    ({
      example: "Each lesson opens with the idea, then a full example, then a quick try.",
      idea: "Each lesson opens with the idea, then a full example, then a quick try.",
      try: "Each lesson opens with the idea, then a full example, then a quick try.",
    })[a.firstStep ?? ""] ?? null,
  style: (a) =>
    ({
      short: "Analogies stay closed and build explanations are folded — except in lessons on extra support.",
      steps: "The analogy is open on every beat and each build step is explained first — except in lessons on a light touch.",
    })[a.style ?? ""] ?? null,
};

/** What an answer changes, or what happens when the question is skipped. */
export function changeFor(q: SetupQuestion, a: SetupAnswers, d?: ProfileDerived | null): { text: string; skipped: boolean } {
  const text = q.extraKey ? (valueOf(q, a) ? "Your plan uses this to tailor its examples to your work." : null) : CHANGE[q.id as QuestionId](a, d);
  return text ? { text, skipped: false } : { text: `Not set — ${q.ifSkipped}.`, skipped: true };
}

export type LessonPart = "idea" | "example" | "try";

/** Teaching sequence, including profiles saved with earlier ordering preferences. */
export function lessonOrder(a: SetupAnswers): LessonPart[] {
  void a;
  return ["idea", "example", "try"];
}

export type Adaptation = {
  domain: Domain | null;
  /** which of the course's role texts fits: students are "student" whatever role they once picked */
  roleKey: RoleKey | null;
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
  opts: { precheck?: PrecheckResult | null; override?: SupportOverride; derived?: ProfileDerived | null } = {},
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
    domain: domainOf(s, opts.derived),
    roleKey: roleKeyOf(s, opts.derived),
    roleLabel: roleLabelOf(s, opts.derived),
    order: lessonOrder(s),
    style: s.style ?? null,
    analogyOpen: s.style === "steps" || (support === "extra" && s.style !== "short"),
    support,
    lessonSupport,
    supportSource,
    override,
    answered: questionsFor(s).filter((q) => answerLabel(q, s) !== null).length,
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
