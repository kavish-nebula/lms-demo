/**
 * Data access for the UI phase. Every screen reads through these functions,
 * so replacing fixtures with the Player API changes this file only.
 * Enrolment, setup answers and progress are client-side (src/lib/enrollment.ts,
 * src/lib/course-progress.ts) until the API exists.
 */
import learnerJson from "@lms/fixtures/learner.json";
import coursesJson from "@lms/fixtures/courses.json";
import moduleM1 from "@lms/fixtures/module-n8n-m1.json";
import finaleN8n from "@lms/fixtures/finale-n8n.json";
import precheckN8n from "@lms/fixtures/precheck-n8n.json";
import videosN8n from "@lms/fixtures/videos-n8n.json";
import guidedN8nM2 from "@lms/fixtures/guided-n8n-m2.json";
import type { ConceptVideo, Course, CourseModule, ExplainerBlock, FinaleContent, GuidedBlock, Learner, ModuleContent, PrecheckContent } from "./types";

const learner = learnerJson as unknown as Learner;
const videos = (videosN8n as unknown as { course_id: string; videos: ConceptVideo[] }).videos;
const baseCourses = (coursesJson as unknown as { courses: Course[] }).courses;
/** Guided practice written for modules that are otherwise concept-only. */
const guided = [guidedN8nM2 as unknown as { course_id: string; module_id: string; block: GuidedBlock }];

/** Module 1's concept topic is taught by its videos, like every other module. */
function withVideos(mod: ModuleContent): ModuleContent {
  const vids = videos.filter((v) => v.module === mod.module_id);
  if (!vids.length) return mod;
  return {
    ...mod,
    blocks: mod.blocks.map((b) => (b.stage === "explainer" ? ({ ...b, videos: vids } as ExplainerBlock) : b)),
  };
}

/** Modules 2-5: their concept topic (the narrated videos), plus guided practice where it is written. */
function conceptOnly(course: Course, m: CourseModule): ModuleContent | null {
  const vids = videos.filter((v) => v.module === m.module_id);
  if (!vids.length) return null;
  const words = vids.reduce((n, v) => n + v.slides.reduce((k, s) => k + s.narration.split(/\s+/).length, 0), 0);
  const minutes = Math.round(words / 150) + vids.length; // narration at ~150 wpm, plus a minute of checks per video
  const objectives = m.lessons.map((l) => ({ id: `obj-${l.id}`, text: l.title, lesson: l.id }));
  const practice = guided.find((g) => g.course_id === course.course_id && g.module_id === m.module_id)?.block;
  return {
    course_id: course.course_id,
    course_title: course.title,
    module_id: m.module_id,
    version: "1.0.0",
    locale: "en",
    title: m.title,
    summary: m.pain,
    estimated_minutes: minutes + (practice?.duration_min ?? 0),
    stages_included: practice ? ["explainer", "guided"] : ["explainer"],
    metadata: { objectives },
    blocks: [
      {
        step_id: `${m.module_id}.explain`,
        stage: "explainer",
        duration_min: minutes,
        bloom: "understand",
        load: "medium",
        objective_ids: objectives.map((o) => o.id),
        concepts: [],
        segments: [],
        videos: vids,
      } as ExplainerBlock,
      ...(practice ? [practice] : []),
    ],
  };
}

const authored: ModuleContent[] = [
  withVideos(moduleM1 as unknown as ModuleContent),
  ...baseCourses.flatMap((c) => c.modules.filter((m) => m.module_id !== "m1").map((m) => conceptOnly(c, m))).filter((m): m is ModuleContent => !!m),
];

// every module records which of its topics have content, so links go to a playable topic
const courses: Course[] = baseCourses.map((c) => ({
  ...c,
  modules: c.modules.map((m) => ({
    ...m,
    authored: authored.find((a) => a.course_id === c.course_id && a.module_id === m.module_id)?.stages_included ?? [],
  })),
}));
const finales: FinaleContent[] = [finaleN8n as unknown as FinaleContent];
const prechecks: PrecheckContent[] = [precheckN8n as unknown as PrecheckContent];

/** "Today" for the fixtures, so due dates and greetings stay stable. */
export const FIXTURE_TODAY = "2026-10-07";

export async function getLearner(): Promise<Learner> {
  return learner;
}

export async function getCourses(): Promise<Course[]> {
  return courses;
}

export async function getCourse(courseId: string): Promise<Course | undefined> {
  return courses.find((c) => c.course_id === courseId);
}

/** Module lesson content: Module 1 in full; Modules 2-5 have their concept videos. */
export async function getModule(courseId: string, moduleId: string): Promise<ModuleContent | undefined> {
  return authored.find((m) => m.course_id === courseId && m.module_id === moduleId);
}

/** Ids of the modules that have lesson content. */
export async function getAuthoredModuleIds(courseId: string): Promise<string[]> {
  return authored.filter((m) => m.course_id === courseId).map((m) => m.module_id);
}

/** The course finale: capstone, final check and wrap-up, taken after all modules. */
export async function getFinale(courseId: string): Promise<FinaleContent | undefined> {
  return finales.find((f) => f.course_id === courseId);
}

/** The ungraded pre-check asked once, before Module 1. */
export async function getPrecheck(courseId: string): Promise<PrecheckContent | undefined> {
  return prechecks.find((p) => p.course_id === courseId);
}

export const SAMPLE_MODULE_HREF = "/learn/courses/n8n/m1/hook";

export { getBlock } from "./client";
