import "server-only";
import * as z from "zod/v4";
import { LlmError, llmHttp, llmModels, llmReasoning, type LlmMessage, type LlmTransport } from "../ai/llm";
import { acceptable, mergeShape, skeletonOf, type MergeResult } from "./shape";

/**
 * Writes one piece of a module (the problem hook, a concept video, the worked
 * examples) as a fully new scenario in the learner's own world, in the
 * authored piece's exact shape (shape.ts checks and merges it). The first piece
 * written for a learner also invents their "world": a fictional organisation
 * in their field, its people and its trouble, which every later piece reuses,
 * so the whole course tells one story.
 */

export const ADAPT_PROMPT_VERSION = 1;

export type World = {
  organisation: string;
  whatItDoes: string;
  learnerRole: string;
  customers: string;
  people: { name: string; role: string }[];
  problem: string;
};

const WorldIn = z.object({
  organisation: z.string().trim().min(2).max(80),
  whatItDoes: z.string().trim().min(4).max(200),
  learnerRole: z.string().trim().min(2).max(120),
  customers: z.string().trim().min(2).max(160),
  people: z.array(z.object({ name: z.string().trim().min(2).max(40), role: z.string().trim().min(2).max(80) })).min(1).max(6),
  problem: z.string().trim().min(8).max(300),
});

export type PieceBrief = {
  courseTitle: string;
  /** the story the authored course tells, which a rewrite must leave behind */
  authoredWorld: string;
  /** names from the authored story that must not appear in a rewrite */
  banned: RegExp;
  moduleTitle: string;
  lessons: string[];
  /** what this piece is, e.g. "the module's opening problem (a short film)" */
  label: string;
  /** what the plan says about this module for this learner */
  planNote: string | null;
};

export type Written<T> = { content: T; world: World | null; model: string; merge: MergeResult<T> };

export class AdaptError extends Error {
  constructor(public detail: string) {
    super(detail);
  }
}

const INSTRUCTIONS = `You rewrite one piece of an online lesson for one learner on Nebula KnowLab. You write a fully new scenario set in the learner's own world, and you keep the lesson's teaching exactly.

The piece is JSON that the app draws as animated scenes or slides. Reply with the same JSON shape:
- the same keys, the same order, and the same number of items in every list;
- every id, icon, kind, type, tone, role, state, source, target, cue and number exactly as given;
- for slides, the same number of "sentences", each still saying what that slide shows when it is reached (items appear at the sentence index in their "cue");
- a quiz given as null stays as it is (reply null); a quiz given in full is reworded into the new story, with every option keeping its meaning and the same "correct" answer.

What changes is the story: the organisation, the people, the customers, the messages, the examples and the stakes, all in the learner's field and role, as they would recognise them from their own work. What stays is the lesson: the same idea, terms, steps, order of reasoning and conclusion. Technical content stays correct (agents, LLMs, tools, prompts, memory, Python). Code stays valid Python that shows the same thing; you may rename things to fit the new world.

Rules:
- The organisation and people are fictional. Never a real company or a real person.
- The agent the learner builds is still called Scout.
- Never mention the authored story's organisation, products, people or order numbers.
- Keep every text about as long as the original; the layouts are fixed.
- Numbers in the story may change to fit it, but the JSON numbers stay as given.
- No links. No promises about results. Do not mention AI models, prompts to you, or "personalised".
- Write plainly and warmly in British English, addressing the learner as "you" where the original does.

Reply with one JSON object: {"world": <the world, only when asked for>, "piece": <the rewritten piece>}.`;

const http = llmHttp({ timeoutMs: 180_000, retries: 1, backoffMs: 2_000 });

function parseJson(t: string): unknown {
  const body = (/```(?:json)?\s*([\s\S]*?)```/.exec(t)?.[1] ?? t).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function worldText(w: World): string {
  return [
    `Organisation: ${w.organisation} (${w.whatItDoes})`,
    `The learner there: ${w.learnerRole}`,
    `Their customers or the people they serve: ${w.customers}`,
    `People: ${w.people.map((p) => `${p.name}, ${p.role}`).join("; ")}`,
    `The trouble an agent could help with: ${w.problem}`,
  ].join("\n");
}

/** The user message: who the learner is, their world (or a request to invent it), and the piece. */
export function briefFor(brief: PieceBrief, learner: string[], world: World | null, authored: unknown): string {
  return [
    `COURSE: "${brief.courseTitle}". The authored lessons tell this story, which you must leave behind: ${brief.authoredWorld}`,
    "",
    "LEARNER",
    ...learner,
    "",
    world
      ? `THEIR WORLD (already set; keep to it exactly so the whole course tells one story)\n${worldText(world)}`
      : 'THEIR WORLD: not set yet. Invent it from the learner above and return it as "world": {"organisation", "whatItDoes", "learnerRole", "customers", "people": [{"name", "role"}], "problem"}. Make it ordinary and believable for their field and role; for a student, their course, placement or student project.',
    "",
    `MODULE: ${brief.moduleTitle}. Lessons: ${brief.lessons.join("; ")}`,
    ...(brief.planNote ? [`For this learner: ${brief.planNote}`] : []),
    "",
    `PIECE: ${brief.label}`,
    JSON.stringify(skeletonOf(authored, brief.banned)),
  ].join("\n");
}

/** Writes the piece, with one round to fix what did not fit. Throws AdaptError when it can't. */
export async function writePiece<T>(brief: PieceBrief, learner: string[], world: World | null, authored: T, transport: LlmTransport = http): Promise<Written<T>> {
  const size = JSON.stringify(skeletonOf(authored, brief.banned)).length;
  const maxTokens = Math.min(48_000, Math.max(8_000, Math.round(size / 1.4)));
  const messages: LlmMessage[] = [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: briefFor(brief, learner, world, authored) },
  ];
  let last = "the model did not reply";
  for (const model of llmModels()) {
    let best: Written<T> | null = null;
    const turn = [...messages];
    for (let round = 1; round <= 2; round++) {
      let text: string;
      let finish = "";
      try {
        const res = await transport({ model, messages: turn, response_format: { type: "json_object" }, thinking: { type: llmReasoning() }, max_tokens: maxTokens, temperature: 0.7 });
        text = res.choices?.[0]?.message?.content ?? "";
        finish = res.choices?.[0]?.finish_reason ?? "";
      } catch (e) {
        if (!(e instanceof LlmError)) throw e;
        last = e.detail;
        console.warn(`[adapt] ${brief.label}: ${e.detail}`);
        if (e.busy) break; // try the next model
        throw new AdaptError(e.detail);
      }
      const parsed = parseJson(text) as { world?: unknown; piece?: unknown } | null;
      // a model sometimes replies with the piece itself, unwrapped: its keys are the authored piece's
      const unwrapped = parsed && !parsed.piece && authored && typeof authored === "object" && Object.keys(authored).filter((k) => k in parsed).length >= 2;
      const raw = unwrapped ? { world: parsed.world, piece: parsed } : parsed;
      if (!raw?.piece) {
        last = finish === "length" ? "the reply was cut off (too long)" : "the reply had no piece";
        console.warn(`[adapt] ${brief.label} (${model}, round ${round}): ${last}; ${text.length} chars, finish ${finish || "?"}, keys ${parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 6).join(",") : "none"}`);
        turn.push({ role: "assistant", content: text.slice(0, 4000) }, { role: "user", content: 'Reply with one JSON object {"world": ..., "piece": ...} only.' });
        continue;
      }
      const w = world ?? (WorldIn.safeParse(raw.world).success ? (WorldIn.parse(raw.world) as World) : null);
      if (!world && !w) {
        last = "the reply had no usable world";
        turn.push({ role: "assistant", content: text.slice(0, 4000) }, { role: "user", content: 'The "world" object is missing or incomplete. Reply again with the whole JSON, including "world".' });
        continue;
      }
      const merge = mergeShape(authored, raw.piece, { banned: brief.banned });
      const ok = acceptable(merge);
      const candidate: Written<T> = { content: merge.value, world: w, model, merge };
      if (!best || merge.problems.length < best.merge.problems.length) best = candidate;
      if (ok.ok && !merge.problems.length) return candidate;
      last = ok.why ?? `${merge.problems.length} texts did not fit`;
      console.warn(`[adapt] ${brief.label} (${model}, round ${round}): ${last}; ${merge.problems.slice(0, 4).join(" | ")}`);
      turn.push(
        { role: "assistant", content: text.slice(0, 12_000) },
        {
          role: "user",
          content: `Some parts did not fit the shape:\n${merge.problems.slice(0, 25).map((p) => `- ${p}`).join("\n")}\nReply again with the whole JSON object, fixed.`,
        },
      );
    }
    if (best && acceptable(best.merge).ok) return best;
  }
  throw new AdaptError(last);
}
