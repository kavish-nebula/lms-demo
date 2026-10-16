import "server-only";
import { getCourse, getFinale, getModule } from "@/data";
import type { Course, GateBlock, ModuleContent } from "@/data/types";
import { coursePassages, tokens, type CoursePassage } from "@/lib/companion";
import { courseLabel } from "@/lib/course-labels";

/**
 * What Pip knows about one course, built once per course. The outline tells
 * the model what is in scope; the passages are the teaching text it answers
 * from (coursePassages already leaves out assessment items, keys and scenario
 * solutions); the module and final check stems let the server refuse a
 * pasted check question before the model ever sees it. Quick check (precheck)
 * stems are left out on purpose: they ask the course's core ideas plainly
 * ("What makes an AI agent different from a chatbot?"), which is exactly what
 * a learner should be able to ask Pip once the lessons start; the precheck
 * phase itself is closed to Pip.
 */

export type CompanionContext = {
  course: Course;
  outline: string;
  passages: CoursePassage[];
  /** the words of every module check and final check question */
  assessments: { words: string[] }[];
};

const cache = new Map<string, Promise<CompanionContext | null>>();

export function companionContext(courseId: string): Promise<CompanionContext | null> {
  let hit = cache.get(courseId);
  if (!hit) {
    hit = build(courseId);
    cache.set(courseId, hit);
    hit.catch(() => cache.delete(courseId));
  }
  return hit;
}

async function build(courseId: string): Promise<CompanionContext | null> {
  const course = await getCourse(courseId);
  if (!course) return null;
  const modules = (await Promise.all(course.modules.map((m) => getModule(courseId, m.module_id)))).filter((m): m is ModuleContent => !!m);

  const lines = [`COURSE: "${course.title}"`, course.tagline];
  if (course.goal) lines.push(`Goal: ${course.goal}`);
  lines.push(`Level: ${course.level}. About ${course.estimated_hours} hours.`);
  if (course.learn?.length) lines.push(`Learners will: ${course.learn.join(" ")}`);
  if (course.tools?.length) lines.push(`Tools used: ${course.tools.join(", ")}`);
  for (const [i, m] of course.modules.entries()) {
    // the learner sees the short label in the app, so the model uses it too
    const label = courseLabel(courseId, "modules", m.module_id, m.title);
    lines.push("", `Module ${i + 1}: ${label}${label === m.title ? "" : ` (${m.title})`}`);
    if (m.pain) lines.push(`  Problem it solves: ${m.pain}`);
    for (const l of m.lessons) lines.push(`  Lesson ${l.id}: ${l.title}`);
    if (m.skills?.length) lines.push(`  Skills: ${m.skills.join(", ")}`);
  }
  lines.push("", "After the modules: one mini-project (the capstone), then the final assessment, then a wrap-up reflection.");

  const gates: GateBlock[] = modules.flatMap((m) => m.blocks.filter((b): b is GateBlock => b.stage === "gate"));
  const finale = await getFinale(courseId);
  if (finale) gates.push(finale.final);
  // short stems are too generic to tell a pasted question from an honest one
  const assessments = gates.flatMap((g) => g.items.map((item) => ({ words: tokens(item.stem) }))).filter((a) => a.words.length >= 5);

  return { course, outline: lines.join("\n"), passages: coursePassages(course, modules), assessments };
}

/** A message that carries most of an assessment question's words is that question, pasted. */
export function matchesAssessment(message: string, ctx: CompanionContext): boolean {
  const said = new Set(tokens(message));
  if (said.size < 5) return false;
  return ctx.assessments.some((a) => a.words.filter((w) => said.has(w)).length / a.words.length >= 0.75);
}
