/**
 * What the companion (the learner's own agent) says along the way, so the
 * learner always knows where they are and why: each setup step is introduced
 * when it opens, each answer gets a short reaction while the next question
 * is written, and each part of a module says what it's for. Plain, spoken
 * English: short sentences, no jargon. Pure functions, no React.
 *
 * Every line is fixed (no names or answers in it), so each is recorded once
 * and then plays instantly: making a new sentence takes the local voice
 * several seconds, which would make the companion speak late.
 */
import type { ProfileSlot } from "@/lib/profiling";
import type { SetupPhase } from "@/lib/agent-build";

/** Said when a setup step opens. */
export function phaseLine(phase: SetupPhase): string {
  switch (phase) {
    case "profile":
      return "Hi! I'm your agent, and I'll guide you through. First, a few quick questions about your work. Your answers help me shape the course around you.";
    case "intro":
      return "Thanks, that's About you done. Next is a short preview video. It gives you a rough idea of the whole course before we start.";
    case "precheck":
      return "Now a short activity: a two-minute story from your work. It shows me what you already know, so we don't repeat it. There are no right or wrong answers.";
    case "customize":
      return "Thanks. Now I know what you already know. Here is your plan. Check how each lesson starts, then build your course.";
    case "build":
      return "I'm building your course now, just for you. It only takes a few seconds.";
  }
}

export const BUILD_READY_LINE = "Your course is ready. Let's start with the first module.";

/**
 * Said right after an answer, while the next question is being written.
 * Fixed sentences (not echoing the answer), so each is recorded once and
 * then plays instantly, every time.
 */
const REACTIONS: Record<ProfileSlot, string> = {
  context: "Thanks. We'll use examples that fit how you're learning.",
  field: "Great. I'll use examples from your field.",
  experience: "Thanks. I'll start at the right level for you.",
  subrole: "Got it. I'll talk about your kind of work.",
  usecase: "Perfect. That's what I'll help you with.",
  goal: "Thank you. That's everything I need.",
};
const SKIPPED = "No problem, let's skip that one.";
export const answerReaction = (slot: ProfileSlot, label: string | null): string => (label ? REACTIONS[slot] : SKIPPED);

/** Said when a part of a module opens (once per part). */
export function stageLine(stage: string): string | null {
  switch (stage) {
    case "hook":
      return "A new module starts here, with a real problem. Watch what went wrong, then make your call.";
    case "explainer":
      return "Now the idea behind it, in short videos.";
    case "worked":
      return "Here's a worked example. Watch how it's done, step by step.";
    case "guided":
      return "Your turn now. Practise it step by step, with help if you need it.";
    case "lab":
      return "Now some real cases. Use what you just learned.";
    case "gate":
      return "A short check to finish this module. Then I get a new part.";
    case "review":
      return "A quick review, so it stays with you.";
    default:
      return null;
  }
}

/** The reactions to answers: recorded ahead, so they play the instant an answer is picked. */
export const REACTION_LINES: string[] = [...Object.values(REACTIONS), SKIPPED];

/** Lines that never change (recorded once each, then served from disk). */
export const FIXED_LINES: string[] = [
  ...REACTION_LINES,
  BUILD_READY_LINE,
  ...(["profile", "intro", "precheck", "customize", "build"] as const).map((p) => phaseLine(p)),
  ...["hook", "explainer", "worked", "guided", "lab", "gate", "review"].map((s) => stageLine(s) ?? "").filter(Boolean),
];

/** Parts of a module with their own sound (videos); the companion only shows its line there, without speaking. */
export const QUIET_STAGES = new Set(["explainer"]);
