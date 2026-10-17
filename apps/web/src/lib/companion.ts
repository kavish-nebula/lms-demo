import type { Course, ModuleContent } from "@/data/types";

export type CoursePassage = { text: string; title: string; href: string; moduleId: string; stage: string; videoId?: string; kind?: "definition" | "summary" | "narration"; subject?: string; slideTitle?: string };
export type CompanionCourse = { course: Course; passages: CoursePassage[] };
export type CompanionStep = { title: string; guidance: string; hint?: string; phase?: string; videoId?: string; slideTitle?: string };

export function companionNudge(context: { phase: string; moduleTitle?: string; stepTitle?: string }): string {
  const moduleTitle = context.moduleTitle?.trim();
  const stepTitle = context.stepTitle?.split(" · ")[0]?.trim();
  const modulePrefix = moduleTitle ? `${moduleTitle}: ` : "";

  switch (context.phase) {
    case "profile": return "Choose what fits you.";
    case "intro": return "Watch the preview, then take the quick check.";
    case "precheck": return "Answer on your own to find your level.";
    case "customize": return "Choose your support and pace.";
    case "build": return "Your path is ready. Open the first module.";
    case "hook": return `${modulePrefix}predict, then reveal what happened.`;
    case "explainer": return stepTitle
      ? `Play “${stepTitle}” and catch the key idea.`
      : `${modulePrefix}play the idea, then try the check.`;
    case "worked": return `${modulePrefix}predict each move, then reveal it.`;
    case "guided": return `${modulePrefix}finish this checkpoint. Use a hint if stuck.`;
    case "lab": return `${modulePrefix}make a choice, check the result, adjust.`;
    case "gate": return moduleTitle ? `Do the ${moduleTitle} quiz on your own.` : "Do this quiz on your own.";
    case "review": return `${modulePrefix}recall one idea, then check your notes.`;
    case "capstone": return "Build one part, test it, and save the evidence.";
    case "final-check": return "Do the final assessment on your own.";
    case "wrap-up": return "Note one thing you can now build.";
    default: return "Continue when you’re ready.";
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
  return hit ? { text: hit.text, source: { title: hit.title, href: hit.href } } : { text: `I couldn’t find that in ${context.courseTitle}. Name a course idea or ask “What should I do here?”` };
}

export const PHASE_GUIDANCE: Record<string, string> = {
  profile: "Choose what fits you. You can skip or change answers later.",
  intro: "Watch the preview to see what you’ll build. Then take the quick check.",
  precheck: "This check finds your starting point. Pick “unsure” if you don’t know.",
  customize: "Review your plan. Pick your guidance, session length, and study days.",
  build: "You’re set up. Open your journey to meet the Orbit Outdoor team.",
  hook: "See the team’s real problem. Predict, watch, and compare.",
  explainer: "Watch the short explainer. Then change one thing in the experiment.",
  worked: "Predict first, then step through and ask why each choice was made.",
  guided: "Work one checkpoint at a time and test your result. Hints never cost you.",
  lab: "Read the evidence, decide, and check the result. Adjust before moving on.",
  gate: "Answer on your own and submit. Course help is paused until you submit.",
  review: "Write a short note, then recall the idea. Hard ones come back sooner.",
  capstone: "Your mini-project. Follow the checklist, test edge cases, and save evidence.",
  "final-check": "Work on your own and submit when ready. No hints here.",
  "wrap-up": "Note what you can now build. Then do your scheduled practice.",
  course: "Set up your profile and take the quick check. Then follow the modules.",
};
