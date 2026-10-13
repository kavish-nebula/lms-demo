import type { Course, ModuleContent } from "@/data/types";

export type CoursePassage = { text: string; title: string; href: string; moduleId: string; stage: string; videoId?: string; kind?: "definition" | "summary" | "narration"; subject?: string; slideTitle?: string };
export type CompanionCourse = { course: Course; passages: CoursePassage[] };
export type CompanionStep = { title: string; guidance: string; hint?: string; phase?: string; videoId?: string; slideTitle?: string };

export function companionNudge(context: { phase: string; moduleTitle?: string; stepTitle?: string }): string {
  const moduleTitle = context.moduleTitle?.trim();
  const stepTitle = context.stepTitle?.split(" · ")[0]?.trim();
  const modulePrefix = moduleTitle ? `${moduleTitle}: ` : "";

  switch (context.phase) {
    case "profile": return "Choose what fits you so the course can adapt.";
    case "intro": return "Watch the preview, then continue to the quick check.";
    case "precheck": return "Answer independently so the course can match your starting level.";
    case "customize": return "Choose the support and pace that feel right today.";
    case "build": return "Your learning path is ready. Open the first module.";
    case "hook": return `${modulePrefix}make a prediction, then reveal what happened.`;
    case "explainer": return stepTitle
      ? `Play “${stepTitle}” and catch the key idea before the quick check.`
      : `${modulePrefix}play the concept, then try the quick check.`;
    case "worked": return `${modulePrefix}predict each move before revealing the solution.`;
    case "guided": return `${modulePrefix}complete the current checkpoint. Use a hint if you get stuck.`;
    case "lab": return `${modulePrefix}make one choice, inspect the result, then adjust.`;
    case "gate": return moduleTitle ? `Complete the ${moduleTitle} quiz independently.` : "Complete this module quiz independently.";
    case "review": return `${modulePrefix}recall one idea before checking your notes.`;
    case "capstone": return "Build one part of your final project, test it, then save the evidence.";
    case "final-check": return "Complete the final assessment independently.";
    case "wrap-up": return "Capture one thing you can now explain or build.";
    default: return "Continue from your current step when you are ready.";
  }
}

/** Only teaching passages: assessment items, keys, and scenario solutions are excluded. */
export function coursePassages(course: Course, modules: ModuleContent[]): CoursePassage[] {
  const passages: CoursePassage[] = [];
  for (const mod of modules) {
    const base = `/learn/courses/${course.course_id}/${mod.module_id}`;
    for (const b of mod.blocks) {
      const add = (text: string, title: string, href = `${base}/${b.stage}`, videoId?: string, kind: CoursePassage["kind"] = "narration", subject?: string, slideTitle?: string) => {
        if (text.trim()) passages.push({ text: text.replace(/\*\*|`/g, ""), title, href, moduleId: mod.module_id, stage: b.stage, videoId, kind, subject, slideTitle });
      };
      if (b.stage === "hook") add(b.why, mod.title);
      if (b.stage === "explainer") {
        for (const v of b.videos ?? []) {
          const href = `${base}/explainer?v=${v.id}`;
          for (const slide of v.slides) {
            const title = slide.title === v.title ? v.title : `${v.title} · ${slide.title}`;
            add(slide.narration, title, href, v.id, "narration", undefined, slide.title);
            if (slide.kind === "define") add(`${slide.term}: ${slide.definition}\n\n${slide.analogy.text}`, title, href, v.id, "definition", slide.term, slide.title);
          }
          for (const note of v.notes) add(note, `${v.title} · Key ideas`, href, v.id, "summary");
        }
        if (!b.videos?.length) for (const s of b.segments) add(s.notes.join(" "), s.title);
      }
      if (b.stage === "worked") for (const e of b.examples) add(e.narration, e.title);
      if (b.stage === "guided") for (const s of b.steps) add(`${s.body} ${s.actions.join(" ")} ${s.tip ?? ""}`, s.title);
    }
  }
  return passages;
}

const STOP = new Set("a an the and or i my me you your it its is are was be to of for in on with can could would should please explain what how why does this that about meaning mean define definition tell help give course step example understand need want know use using work works".split(" "));
const aliases: Record<string, string> = { tools: "tool", memories: "memory", hallucinations: "hallucination", agents: "agent", prompts: "prompt", llms: "llm", retrys: "retry", retries: "retry", gaurdrails: "guardrail", guardrails: "guardrail" };
const tokens = (s: string) => [...new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => (w.length > 2 || w === "ai") && !STOP.has(w)).map((w) => aliases[w] ?? w))];

/** Answers must match the teaching text, not merely an inherited module title. */
export function findPassage(query: string, passages: CoursePassage[], moduleId?: string, videoId?: string, slideTitle?: string): CoursePassage | undefined {
  const q = tokens(query);
  if (!q.length) return undefined;
  const defining = /^(what (is|are)|define|meaning of)|\b(mean|definition)\b/i.test(query.trim());
  const ranked = passages.map((p) => {
    const body = new Set(tokens(p.text));
    const title = new Set(tokens(p.title));
    const hits = q.filter((w) => body.has(w)).length;
    const titleHits = q.filter((w) => title.has(w)).length;
    const coverage = hits / q.length;
    const subject = tokens(p.subject ?? "");
    const exactDefinition = p.kind === "definition" && subject.length > 0 && q.every((w) => subject.includes(w));
    const score = hits * 3 + titleHits * 2 + coverage
      + (p.moduleId === moduleId ? 2 : 0)
      + (videoId && p.videoId === videoId ? 6 : 0)
      + (slideTitle && p.slideTitle === slideTitle ? 1 : 0)
      + (exactDefinition ? defining ? 12 : 6 : 0)
      + (p.kind === "summary" ? 3 : 0);
    return { p, coverage, score };
  }).filter((r) => r.coverage >= 0.75).sort((a, b) => b.score - a.score);
  return ranked[0]?.p;
}

export function companionReply(query: string, context: { phase: string; guidance: string; nextStep?: string; hint?: string; courseTitle: string; moduleId?: string; videoId?: string; slideTitle?: string; passages: CoursePassage[] }): { text: string; source?: Pick<CoursePassage, "title" | "href"> } {
  if (["gate", "final-check", "precheck"].includes(context.phase)) return { text: PHASE_GUIDANCE[context.phase]! };
  const prompt = query.trim();
  if (/^(hint|give me a hint)[?.!]?$/i.test(prompt)) return { text: context.hint || context.nextStep || context.guidance };
  if (/^(next step|what should i do here|help me with this step|how does this work)[?.!]?$/i.test(prompt)) return { text: context.nextStep || context.guidance };
  if (/^(explain this(?: step| slide)?|what does this mean)[?.!]?$/i.test(prompt)) return { text: context.guidance };
  const hit = findPassage(query, context.passages, context.moduleId, context.videoId, context.slideTitle);
  return hit ? { text: hit.text, source: { title: hit.title, href: hit.href } } : { text: `I couldn’t find a reliable match in ${context.courseTitle}. Try naming the course concept or ask “What should I do here?” I can help with this course only.` };
}

export const PHASE_GUIDANCE: Record<string, string> = {
  profile: "Choose the answers that fit you today. You can skip a question or change your preferences later. Your choices set examples, lesson order, and starting support.",
  intro: "Watch the course preview to see what you will build. You can pause, replay, or read the transcript before continuing to the quick check.",
  precheck: "This quick check finds your starting point. Choose what you know, or use the unsure option. I can explain the process, but will leave the answers to you.",
  customize: "Review your starting plan. Choose your guidance level, session length, and study days. You can adjust your guidance in every module.",
  build: "Your course setup is ready. Open your journey to begin the first problem and meet the Orbit Outdoor team.",
  hook: "Explore the team's real problem. Make a prediction, watch what happens, and compare it with your initial idea. You can replay the scene.",
  explainer: "Watch a short explanation, use the transcript when useful, then open the experiment to change one thing and observe the outcome.",
  worked: "Predict what will happen before running the example. Step through the result and ask why each decision was made.",
  guided: "Accept the mission, work through one checkpoint at a time, and test your result. Ask for a hint whenever useful; help does not reduce your reward.",
  lab: "Read the evidence, make your decision, then inspect its consequence. Revise your approach before moving to the next situation.",
  gate: "This is an independent mastery check. Answer the questions and submit when ready. I can help with navigation, but course explanations are paused here. After submission, use the review links to practise and return.",
  review: "Write a short reflection, then practise recalling the idea in a new situation. Rate your recall honestly; difficult reviews return sooner.",
  capstone: "This is your one course mini-project. Use the brief and checklist to assemble what you learned, test the edge cases, and save your project evidence before the final assessment.",
  "final-check": "Your final assessment follows the mini-project. Work independently and submit when ready. I can explain the process, but cannot provide answers or course hints here.",
  "wrap-up": "Reflect on what changed in your understanding and what you can now build. Save your reflection and revisit the scheduled practice challenges.",
  course: "Start with your profile, course preview, and quick check. Then follow the mission trail through the modules. One mini-project comes immediately before the final assessment.",
};
