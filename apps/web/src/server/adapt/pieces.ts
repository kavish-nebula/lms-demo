import "server-only";
import { getBlock } from "@/data/client";
import type { ConceptVideo, HookBlock, ModuleContent, WorkedBlock } from "@/data/types";
import type { AdaptedPiece } from "@/server/db/schema";
import type { Clip } from "./tts";

/**
 * The pieces of a module that are rewritten for each learner, in the order
 * the learner meets them (so the first ones are ready first): the problem
 * hook, each concept video, then the worked examples. Each piece names the
 * narration clips the player loads for it.
 */

export type PieceDef = {
  piece: Exclude<AdaptedPiece, "world">;
  label: string;
  authored: unknown;
  /** the narration lines, keyed as the player asks for them */
  clips: (content: unknown) => Clip[];
};

/** The story each course's authored lessons tell, which a rewrite leaves behind. */
export const AUTHORED_WORLD: Record<string, { text: string; banned: RegExp }> = {
  "ai-agent": {
    text: "Orbit Outdoor, an online outdoor-gear shop. Its founder Maya, support lead Leo and developer Priya build a support agent called Scout that answers customers (order numbers like ORB-10482).",
    banned: /\b(Orbit|ORB-\d+|Maya|Leo|Priya)\b/i,
  },
};
const FALLBACK_WORLD = { text: "the course's own example organisation", banned: /(?!)/ };
export const authoredWorld = (courseId: string) => AUTHORED_WORLD[courseId] ?? FALLBACK_WORLD;

const hookClips = (c: unknown): Clip[] => {
  const h = c as HookBlock;
  return [
    { key: "open", text: h.narration ?? "" },
    ...(h.film?.shots ?? []).flatMap((s, i) => [{ key: `s${i}`, text: s.say ?? "" }, ...("then" in s && s.then ? [{ key: `s${i}-then`, text: s.then }] : [])]),
    ...(h.reveal?.timeline ?? []).map((f, k) => ({ key: `r${k}`, text: f.caption ?? "" })),
  ];
};

const videoClips = (c: unknown): Clip[] => (c as ConceptVideo).slides.map((s, i) => ({ key: `s${i}`, text: s.narration }));

export function piecesOf(mod: ModuleContent): PieceDef[] {
  const out: PieceDef[] = [];
  const hook = getBlock(mod, "hook");
  if (hook && !hook.status) out.push({ piece: "hook", label: "the module's opening problem: a short illustrated film, then what really happened", authored: hook, clips: hookClips });
  for (const v of getBlock(mod, "explainer")?.videos ?? [])
    out.push({ piece: `video:${v.id}`, label: `the narrated concept video for lesson ${v.lesson}, "${v.title}" (slides, with a quiz or two)`, authored: v, clips: videoClips });
  const worked = getBlock(mod, "worked") as WorkedBlock | undefined;
  if (worked && !worked.status) out.push({ piece: "worked", label: "the worked examples: an agent solving a case step by step, with a prediction question", authored: worked, clips: () => [] });
  return out;
}

/** Where a piece's clips live, as a folder name. */
export const pieceDir = (piece: string) => piece.replace(/[^\w-]/g, "-");
