import "server-only";

/**
 * The authored piece is the skeleton every rewrite must fit. Lessons are drawn
 * by components that rely on its shape: scene and slide types, ids, the cue
 * that shows each item when the narration reaches a sentence, counts, numbers,
 * the right answer. So the model rewrites only the words, and a rewrite is
 * merged onto the authored piece key by key:
 *  - objects keep the authored keys (extra keys are dropped, missing ones are a problem);
 *  - arrays keep the authored length;
 *  - numbers, booleans and nulls always stay authored;
 *  - ids, icons, links between diagram nodes and enum values (a slide's kind,
 *    a scene's type, a message's role…) stay authored;
 *  - quizzes stay authored (assessment is never personalised), except one that
 *    names the authored story: its wording follows the new story, while the
 *    right answer (a number) stays where it was;
 *  - every other string is the learner's version, if it is a sensible one.
 * A slide's narration is its sentences joined, as the build script makes it.
 */

/** Quiz lists: each quiz stays authored unless it names the authored story. */
const QUIZZES = new Set(["midQuiz", "endQuiz"]);
const namesStory = (x: unknown, banned?: RegExp) => !!banned && new RegExp(banned.source, banned.flags.replace("g", "")).test(JSON.stringify(x));
/** String keys that name things rather than say them. */
const LOCKED = new Set(["id", "step_id", "lesson", "module", "stage", "icon", "correct", "source", "target", "objective_ids", "bloom", "load"]);
/** String keys that are an enum when their value is a short lowercase word (an email's `from` is a name, a chat line's is "customer"). */
const ENUMISH = new Set(["kind", "type", "tone", "role", "state", "from"]);
const isEnumValue = (v: string) => /^[a-z][a-z-]{0,15}$/.test(v);
const LINK = /https?:\/\/|www\./i;

export type MergeResult<T> = {
  value: T;
  /** texts in the result that still name the authored story */
  storyLeft: number;
  /** strings the learner could see */
  free: number;
  /** of those, how many the rewrite changed */
  changed: number;
  /** where the rewrite did not fit, as "path: why" */
  problems: string[];
  /** authored strings that survived unchanged */
  leftovers: string[];
};

/** What the model is shown: the authored piece without derived narration, and only the quizzes it may reword. */
export function skeletonOf(authored: unknown, banned?: RegExp): unknown {
  if (Array.isArray(authored)) return authored.map((x) => skeletonOf(x, banned));
  if (authored && typeof authored === "object") {
    const o = authored as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (QUIZZES.has(k)) {
        if (Array.isArray(v) && v.some((q) => namesStory(q, banned))) out[k] = v.map((q) => (namesStory(q, banned) ? skeletonOf(q, banned) : null));
        continue;
      }
      if (k === "narration" && Array.isArray(o.sentences)) continue;
      out[k] = skeletonOf(v, banned);
    }
    return out;
  }
  return authored;
}

/** The rewrite merged onto the authored piece; `problems` lists what had to stay authored. */
export function mergeShape<T>(authored: T, generated: unknown, opts: { banned?: RegExp } = {}): MergeResult<T> {
  const r = { free: 0, changed: 0, problems: [] as string[], leftovers: [] as string[] };

  const walk = (a: unknown, g: unknown, path: string, key: string): unknown => {
    if (QUIZZES.has(key)) {
      if (!Array.isArray(a) || !a.some((q) => namesStory(q, opts.banned))) return a;
      const gl = Array.isArray(g) ? g : [];
      return a.map((q, i) => (namesStory(q, opts.banned) ? walk(q, gl[i], `${path}[${i}]`, "") : q));
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(g) || g.length !== a.length) {
        r.problems.push(`${path}: expected a list of ${a.length}`);
        countFree(a, path);
        return a;
      }
      return a.map((x, i) => walk(x, g[i], `${path}[${i}]`, key));
    }
    if (a && typeof a === "object") {
      const ao = a as Record<string, unknown>;
      const go = g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, unknown>) : null;
      if (!go) {
        r.problems.push(`${path}: expected an object`);
        countFree(a, path);
        return a;
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ao)) {
        if (k === "narration" && Array.isArray(ao.sentences)) continue; // rebuilt below
        if (!(k in go) && !QUIZZES.has(k) && !isLocked(k, v)) {
          r.problems.push(`${path}.${k}: missing`);
          countFree(v, `${path}.${k}`);
          out[k] = v;
          continue;
        }
        out[k] = walk(v, go[k], `${path}.${k}`, k);
      }
      if (Array.isArray(ao.sentences) && "narration" in ao) out.narration = (out.sentences as string[]).join(" ").trim();
      return out;
    }
    if (typeof a === "string") {
      if (isLocked(key, a)) return a;
      if (!a.trim()) return a; // an authored empty string stays empty
      r.free++;
      const why = badString(a, g, opts.banned);
      if (why) {
        r.problems.push(`${path}: ${why}`);
        return a;
      }
      const s = (g as string).trim();
      if (s === a.trim()) r.leftovers.push(path);
      else r.changed++;
      return s;
    }
    return a; // numbers, booleans, null: always authored
  };

  const countFree = (a: unknown, path: string) => {
    if (typeof a === "string") {
      if (a.trim()) {
        r.free++;
        r.leftovers.push(path);
      }
    } else if (Array.isArray(a)) a.forEach((x, i) => countFree(x, `${path}[${i}]`));
    else if (a && typeof a === "object") for (const [k, v] of Object.entries(a)) if (!QUIZZES.has(k) && !isLocked(k, v)) countFree(v, `${path}.${k}`);
  };

  const value = walk(authored, generated, "$", "") as T;
  // an authored text kept where the rewrite didn't fit must not bring the old story back
  const survivors = opts.banned ? storyLeft(value, opts.banned) : [];
  for (const p of survivors) if (!r.problems.some((x) => x.startsWith(`${p}:`))) r.problems.push(`${p}: still the authored story`);
  return { value, ...r, storyLeft: survivors.length };
}

function isLocked(key: string, v: unknown): boolean {
  if (typeof v !== "string") return false;
  return LOCKED.has(key) || (ENUMISH.has(key) && isEnumValue(v));
}

/** Why a rewritten string can't be used, or null. Lengths stay near the authored one so layouts hold. */
function badString(authored: string, g: unknown, banned?: RegExp): string | null {
  if (typeof g !== "string") return "not text";
  const s = g.trim();
  if (!s) return "empty";
  const max = Math.max(40, Math.round(authored.length * 1.8) + 30);
  if (s.length > max) return `too long (${s.length} > ${max})`;
  if (LINK.test(s) && !LINK.test(authored)) return "a link";
  if (banned?.test(s)) return `mentions ${s.match(banned)?.[0]}`;
  return null;
}

/**
 * Whether a merge is good enough to show: it fits, and none of the authored
 * story is left. How much changed is no test: a concept video's definitions
 * and terms rightly stay, only its story and examples move.
 */
export function acceptable(m: MergeResult<unknown>): { ok: boolean; why?: string } {
  if (!m.free) return { ok: false, why: "nothing to rewrite" };
  if (m.storyLeft) return { ok: false, why: `${m.storyLeft} texts still tell the authored story` };
  const bad = m.problems.length / m.free;
  if (bad > 0.03) return { ok: false, why: `${m.problems.length} of ${m.free} texts did not fit` };
  // a setup video has little story to move, so a handful of changes is right there
  if (!m.changed) return { ok: false, why: "nothing was rewritten" };
  return { ok: true };
}

/** Paths of strings that name the authored story (quizzes that don't name it are authored and fine). */
function storyLeft(v: unknown, banned: RegExp, path = "$"): string[] {
  const re = new RegExp(banned.source, banned.flags.replace("g", ""));
  if (typeof v === "string") return re.test(v) ? [path] : [];
  if (Array.isArray(v)) return v.flatMap((x, i) => storyLeft(x, banned, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => storyLeft(x, banned, `${path}.${k}`));
  return [];
}
