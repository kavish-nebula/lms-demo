import "server-only";
import { getCourse, getModule, getPrecheck } from "@/data";
import type { HookBlock } from "@/data/types";

/**
 * The course as the planner sees it: modules, topics in outline order
 * (and which are written yet), lessons and their key ideas, each module's
 * opening scenario, and what the quick check tests. Identical for every
 * learner, so it is sent first and cached between calls.
 */

export type ContextModule = {
  id: string;
  index: number;
  title: string;
  /** topic stage ids in outline order */
  stages: string[];
  authored: string[];
  lessons: { id: string; title: string }[];
  hasHook: boolean;
};

export type CourseContext = { courseId: string; title: string; modules: ContextModule[]; text: string };

const cache = new Map<string, Promise<CourseContext>>();

export function courseContext(courseId: string): Promise<CourseContext> {
  let hit = cache.get(courseId);
  if (!hit) {
    hit = build(courseId);
    cache.set(courseId, hit);
    hit.catch(() => cache.delete(courseId));
  }
  return hit;
}

async function build(courseId: string): Promise<CourseContext> {
  const course = await getCourse(courseId);
  if (!course) throw new Error(`Unknown course ${courseId}`);
  const precheck = await getPrecheck(courseId);
  const modules: ContextModule[] = [];
  const lines: string[] = [];

  lines.push(`COURSE ${course.course_id}: "${course.title}"`);
  lines.push(course.tagline);
  lines.push(`Level: ${course.level}. About ${course.estimated_hours} hours. Story: Nebula, a coffee subscription company; Ana is the founder.`);
  lines.push("");

  for (const [i, m] of course.modules.entries()) {
    const content = await getModule(courseId, m.module_id);
    const hook = content?.blocks.find((b) => b.stage === "hook") as HookBlock | undefined;
    const authored = m.authored ?? [];
    modules.push({
      id: m.module_id,
      index: i + 1,
      title: m.title,
      stages: [...m.stages],
      authored: [...authored],
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title })),
      hasHook: !!hook,
    });
    lines.push(`MODULE ${m.module_id} (module ${i + 1}): "${m.title}", about ${m.minutes} min`);
    lines.push(`  Problem: ${m.pain}`);
    lines.push(`  Topics in outline order (stage id: title [written | coming soon]):`);
    for (const s of m.stages) {
      const t = m.topics.find((x) => x.stage === s);
      lines.push(`    - ${s}: ${t?.title ?? s}${t?.summary ? `. ${t.summary}` : ""} [${authored.includes(s) ? "written" : "coming soon"}]`);
    }
    lines.push(`  Lessons:`);
    for (const l of m.lessons) lines.push(`    - ${l.id} "${l.title}": ${(l.notes ?? []).join(" ")}`);
    if (hook) lines.push(`  Opening scenario (hook): ${hook.why}`);
    if (m.outcomes?.length) lines.push(`  Outcomes: ${m.outcomes.join("; ")}`);
    lines.push("");
  }

  if (precheck?.items.length) {
    lines.push("QUICK CHECK (ungraded, taken before the course; 2 questions per lesson):");
    for (const it of precheck.items) lines.push(`  - ${it.id} tests lesson ${it.lesson}: ${it.stem}`);
    lines.push("");
  }

  lines.push(`AFTER ALL MODULES: ${course.finale.steps.map((s) => `${s.kicker} (${s.title}): ${s.summary}`).join(" | ")}`);

  return { courseId, title: course.title, modules, text: lines.join("\n") };
}
