#!/usr/bin/env node
/**
 * Builds "Build Your First AI Agent" from its compact sources in
 * fixtures/src/ai-agent (see AUTHORING.md there) into the fixture files the
 * app reads:
 *
 *   fixtures/courses.json               the catalog entry (lesson notes and minutes filled in)
 *   fixtures/module-ai-agent-m{1-6}.json each module's phases
 *   fixtures/videos-ai-agent.json        every concept video
 *   fixtures/intro-ai-agent.json         the course preview video
 *   fixtures/precheck-ai-agent.json      the prior-knowledge check
 *   fixtures/finale-ai-agent.json        mini project, final assessment, reflection
 *   fixtures/mock-gate-keys.json         answer keys (mock grading only)
 *
 * Usage:
 *   node fixtures/scripts/build-ai-agent.mjs            validate everything, then write
 *   node fixtures/scripts/build-ai-agent.mjs --check    validate everything, write nothing
 *   node fixtures/scripts/build-ai-agent.mjs --check m3 validate one module only
 *   node fixtures/scripts/build-ai-agent.mjs --check course   validate the preview, pre-check and finale only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(here, "..");
const SRC = path.join(FIX, "src", "ai-agent");

const args = process.argv.slice(2);
const ONLY = args.find((a) => /^m\d$/.test(a));
/** `--check course`: only the course-level files (preview video, pre-check, finale) */
const COURSE_ONLY = args.includes("course");
const CHECK = args.includes("--check") || COURSE_ONLY;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function readJson(file, where) {
  if (!fs.existsSync(file)) {
    err(where, `missing file ${path.relative(FIX, file)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    err(where, `invalid JSON: ${e.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ vocab */

const ICONS = new Set(
  (
    "bot brain wrench message sparkles globe calculator key shield server cloud rocket gauge dollar layers target repeat " +
    "list-checks git-branch users terminal plug bug book lock folder settings play chart thumbs-up help timer package truck " +
    "receipt check json cpu history link hand scale lightbulb flask award map workflow zap boxes send table form clock webhook " +
    "bell-off download pencil split arrow-right x-circle eye alert file headset filter copy database code calendar shop factory user mail search"
  ).split(/\s+/),
);
const FLOW_KINDS = new Set(["user", "llm", "tool", "memory", "output", "guard", "trigger", "data", "logic", "action"]);
const NODE_KINDS = new Set(["user", "llm", "tool", "memory", "api", "guard", "output", "plan", "data", "logic", "trigger", "action"]);
const STATES = new Set(["idle", "running", "ok", "error"]);
const CHAT_ROLES = new Set(["user", "agent", "tool", "system"]);
const TONES = new Set(["bad", "ok", "info"]);

/* ------------------------------------------------------------------ helpers */

/**
 * Authors tend to put the right answer in the same place, so the build
 * shuffles every set of options. The order is seeded by the question's id, so
 * it stays the same from build to build.
 */
function shuffled(list, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function str(obj, key, where, { max } = {}) {
  const v = obj?.[key];
  if (!isStr(v)) {
    err(where, `"${key}" must be a non-empty string`);
    return "";
  }
  if (max && v.length > max) warn(where, `"${key}" is ${v.length} characters; keep it under ${max}`);
  return v;
}

function arr(obj, key, where, min, max) {
  const v = obj?.[key];
  if (!Array.isArray(v)) {
    err(where, `"${key}" must be an array`);
    return [];
  }
  if (v.length < min || v.length > max) err(where, `"${key}" has ${v.length} items; expected ${min === max ? min : `${min} to ${max}`}`);
  return v;
}

function allowedKeys(obj, keys, where) {
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) if (!keys.includes(k) && !k.startsWith("$")) warn(where, `unknown field "${k}" (typo?)`);
}

function icon(v, where) {
  if (!ICONS.has(v)) err(where, `unknown icon "${v}"; see AUTHORING.md for the list`);
}

/** Narration is read by a speech engine: keep out what it reads badly. */
function checkSentence(s, where) {
  if (!isStr(s)) return err(where, "sentence must be a non-empty string");
  const n = words(s);
  if (n > 40) err(where, `sentence has ${n} words; split it (max 35)`);
  else if (n > 35) warn(where, `sentence has ${n} words; aim for 25 or fewer`);
  const bad = s.match(/[→←$%&#*`|{}[\]<>—_~^=+\\]/u);
  if (bad) err(where, `narration contains "${bad[0]}", which the voice reads badly; write it out in words`);
  if (/\p{Extended_Pictographic}/u.test(s)) err(where, "narration contains an emoji");
  if (/\s\/\s|\w\/\w/.test(s)) warn(where, `narration contains "/", which the voice reads as "slash"`);
}

function cue(v, n, where) {
  if (!isInt(v) || v < 0 || v >= n) err(where, `cue ${JSON.stringify(v)} must be an integer from 0 to ${n - 1} (the slide has ${n} sentences)`);
  return isInt(v) ? v : 0;
}

function rising(cues, where) {
  for (let i = 1; i < cues.length; i++) if (cues[i] < cues[i - 1]) warn(where, `cues go down (${cues.join(", ")}); items appear out of order`);
}

/* ------------------------------------------------------------------ videos */

const SLIDE_FIELDS = {
  title: ["icon", "kicker", "sub"],
  compare: ["left", "right"],
  define: ["term", "definition", "parts", "analogy"],
  flow: ["run", "nodes", "note"],
  bullets: ["lead", "bullets", "aside"],
  example: ["scenario", "steps", "result"],
  cards: ["tags", "cards"],
  table: ["columns", "rows", "note"],
  code: ["lead", "rows", "aside"],
  recap: ["points"],
  hub: ["center", "spokes", "note"],
  cycle: ["center", "steps", "note"],
  chat: ["messages", "aside"],
};

function checkAside(a, n, where) {
  if (!a || typeof a !== "object") return err(where, "missing aside {icon, label, text, cue}");
  icon(a.icon, where);
  str(a, "label", where, { max: 30 });
  str(a, "text", where, { max: 140 });
  cue(a.cue, n, where);
}

function checkSlide(s, i, where) {
  const w = `${where} slide ${i} (${s?.kind})`;
  if (!s || !SLIDE_FIELDS[s.kind]) return err(w, `unknown slide kind; use one of ${Object.keys(SLIDE_FIELDS).join(", ")}`);
  allowedKeys(s, ["kind", "title", "sentences", ...SLIDE_FIELDS[s.kind]], w);
  str(s, "title", w, { max: 70 });
  const sentences = arr(s, "sentences", w, 2, 9);
  sentences.forEach((x, k) => checkSentence(x, `${w} sentence ${k}`));
  const n = sentences.length || 1;
  const cues = (list, wl) => {
    const cs = list.map((x, k) => cue(x?.cue, n, `${wl} ${k}`));
    rising(cs, wl);
    return cs;
  };
  switch (s.kind) {
    case "title":
      icon(s.icon, w);
      str(s, "kicker", w, { max: 40 });
      str(s, "sub", w, { max: 110 });
      break;
    case "compare":
      for (const side of ["left", "right"]) {
        const c = s[side];
        if (!c) {
          err(w, `missing "${side}"`);
          continue;
        }
        str(c, "label", `${w} ${side}`, { max: 30 });
        if (!TONES.has(c.tone)) err(`${w} ${side}`, `tone must be bad, ok or info`);
        cue(c.cue, n, `${w} ${side}`);
        arr(c, "points", `${w} ${side}`, 2, 5).forEach((p, k) => isStr(p) || err(`${w} ${side} point ${k}`, "must be a string"));
      }
      break;
    case "define": {
      str(s, "term", w, { max: 40 });
      str(s, "definition", w, { max: 160 });
      const parts = arr(s, "parts", w, 2, 4);
      parts.forEach((p, k) => str(p, "text", `${w} part ${k}`, { max: 40 }));
      const cs = cues(parts, `${w} part`);
      if (!s.analogy) err(w, "missing analogy {label, text}");
      else {
        str(s.analogy, "label", w);
        str(s.analogy, "text", w, { max: 180 });
      }
      const last = cs.at(-1) ?? 0;
      if (last + 1 >= n) err(w, `the analogy appears at sentence ${last + 1} (last part cue + 1), but the slide has only ${n} sentences`);
      break;
    }
    case "flow": {
      if (s.run !== undefined && typeof s.run !== "boolean") err(w, `"run" must be true or false`);
      const nodes = arr(s, "nodes", w, 2, 5);
      nodes.forEach((x, k) => {
        const wn = `${w} node ${k}`;
        if (!FLOW_KINDS.has(x?.kind)) err(wn, `kind must be one of ${[...FLOW_KINDS].join(", ")}`);
        icon(x?.icon, wn);
        str(x, "label", wn, { max: 22 });
        str(x, "sub", wn, { max: 30 });
      });
      cues(nodes, `${w} node`);
      if (!s.note) err(w, "missing note {text, cue}");
      else {
        str(s.note, "text", w, { max: 140 });
        cue(s.note.cue, n, `${w} note`);
      }
      break;
    }
    case "bullets": {
      str(s, "lead", w, { max: 140 });
      const b = arr(s, "bullets", w, 3, 5);
      b.forEach((x, k) => {
        icon(x?.icon, `${w} bullet ${k}`);
        str(x, "text", `${w} bullet ${k}`, { max: 90 });
      });
      cues(b, `${w} bullet`);
      checkAside(s.aside, n, `${w} aside`);
      break;
    }
    case "example": {
      str(s, "scenario", w, { max: 140 });
      const st = arr(s, "steps", w, 3, 5);
      st.forEach((x, k) => {
        str(x, "time", `${w} step ${k}`, { max: 12 });
        icon(x?.icon, `${w} step ${k}`);
        str(x, "text", `${w} step ${k}`, { max: 100 });
      });
      cues(st, `${w} step`);
      if (!s.result) err(w, "missing result {text, cue}");
      else {
        str(s.result, "text", w, { max: 140 });
        cue(s.result.cue, n, `${w} result`);
      }
      break;
    }
    case "cards": {
      if (s.tags !== undefined && (!Array.isArray(s.tags) || s.tags.length !== 3)) err(w, `"tags" must be 3 labels`);
      const c = arr(s, "cards", w, 3, 3);
      c.forEach((x, k) => {
        icon(x?.icon, `${w} card ${k}`);
        str(x, "title", `${w} card ${k}`, { max: 28 });
        arr(x, "flow", `${w} card ${k}`, 3, 3).forEach((f, j) => isStr(f) || err(`${w} card ${k} flow ${j}`, "must be a string"));
      });
      cues(c, `${w} card`);
      break;
    }
    case "table": {
      const cols = arr(s, "columns", w, 2, 4);
      const rows = arr(s, "rows", w, 2, 5);
      rows.forEach((r, k) => {
        if (!Array.isArray(r?.cells) || r.cells.length !== cols.length) err(`${w} row ${k}`, `needs ${cols.length} cells`);
        if (r?.tone !== undefined && r.tone !== "bad") err(`${w} row ${k}`, `tone can only be "bad"`);
      });
      cues(rows, `${w} row`);
      if (!s.note) err(w, "missing note {text, cue}");
      else {
        str(s.note, "text", w, { max: 140 });
        cue(s.note.cue, n, `${w} note`);
      }
      break;
    }
    case "code": {
      str(s, "lead", w, { max: 140 });
      const rows = arr(s, "rows", w, 2, 4);
      rows.forEach((r, k) => {
        str(r, "code", `${w} row ${k}`, { max: 70 });
        str(r, "out", `${w} row ${k}`, { max: 60 });
      });
      cues(rows, `${w} row`);
      checkAside(s.aside, n, `${w} aside`);
      break;
    }
    case "recap": {
      const p = arr(s, "points", w, 3, 5);
      p.forEach((x, k) => str(x, "text", `${w} point ${k}`, { max: 100 }));
      cues(p, `${w} point`);
      break;
    }
    case "hub": {
      if (!s.center) err(w, "missing center {icon, label, sub}");
      else {
        icon(s.center.icon, `${w} center`);
        str(s.center, "label", `${w} center`, { max: 20 });
        str(s.center, "sub", `${w} center`, { max: 30 });
      }
      const sp = arr(s, "spokes", w, 3, 6);
      sp.forEach((x, k) => {
        icon(x?.icon, `${w} spoke ${k}`);
        str(x, "label", `${w} spoke ${k}`, { max: 20 });
        str(x, "sub", `${w} spoke ${k}`, { max: 34 });
      });
      cues(sp, `${w} spoke`);
      if (s.note) {
        str(s.note, "text", `${w} note`, { max: 140 });
        cue(s.note.cue, n, `${w} note`);
      }
      break;
    }
    case "cycle": {
      if (!s.center) err(w, "missing center {label, sub}");
      else {
        str(s.center, "label", `${w} center`, { max: 20 });
        str(s.center, "sub", `${w} center`, { max: 34 });
      }
      const st = arr(s, "steps", w, 3, 5);
      st.forEach((x, k) => {
        icon(x?.icon, `${w} step ${k}`);
        str(x, "label", `${w} step ${k}`, { max: 18 });
        str(x, "sub", `${w} step ${k}`, { max: 30 });
      });
      cues(st, `${w} step`);
      if (s.note) {
        str(s.note, "text", `${w} note`, { max: 140 });
        cue(s.note.cue, n, `${w} note`);
      }
      break;
    }
    case "chat": {
      const m = arr(s, "messages", w, 2, 6);
      m.forEach((x, k) => {
        if (!CHAT_ROLES.has(x?.role)) err(`${w} message ${k}`, `role must be user, agent, tool or system`);
        if (x?.label !== undefined && !isStr(x.label)) err(`${w} message ${k}`, `"label" must be a string`);
        str(x, "text", `${w} message ${k}`, { max: 180 });
      });
      cues(m, `${w} message`);
      if (s.aside) checkAside(s.aside, n, `${w} aside`);
      break;
    }
  }
}

function checkQuiz(list, where) {
  list.forEach((q, i) => {
    const w = `${where} ${i}`;
    allowedKeys(q, ["q", "options", "correct", "explain", "hint"], w);
    str(q, "q", w, { max: 160 });
    const o = arr(q, "options", w, 3, 3);
    o.forEach((x, k) => isStr(x) || err(`${w} option ${k}`, "must be a string"));
    if (!isInt(q?.correct) || q.correct < 0 || q.correct > 2) err(w, `"correct" must be 0, 1 or 2`);
    str(q, "explain", w, { max: 220 });
    str(q, "hint", w, { max: 180 });
  });
}

/** A compact video source -> ConceptVideo. */
function buildVideo(src, id, moduleId, where, { quizzes = true } = {}) {
  if (!src) return null;
  allowedKeys(src, ["lesson", "title", "notes", "quizAfter", "slides", "midQuiz", "endQuiz"], where);
  str(src, "title", where, { max: 70 });
  const notes = arr(src, "notes", where, quizzes ? 2 : 0, 4);
  notes.forEach((x, k) => isStr(x) || err(`${where} note ${k}`, "must be a string"));
  const slides = arr(src, "slides", where, 5, 10);
  if (slides.length && (slides.length < 6 || slides.length > 9)) warn(where, `${slides.length} slides; aim for 6 to 9`);
  slides.forEach((s, i) => checkSlide(s, i, where));
  if (slides.length && slides[0]?.kind !== "title") err(where, "the first slide must be a title slide");
  if (slides.length && slides.at(-1)?.kind !== "recap") err(where, "the last slide must be a recap slide");
  const kinds = new Set(slides.map((s) => s?.kind));
  if (slides.length && kinds.size < 4) warn(where, `only ${kinds.size} slide kinds; use at least 4`);
  let quizAfter = null;
  let midQuiz = [];
  let endQuiz = [];
  if (quizzes) {
    if (!isInt(src.quizAfter) || src.quizAfter < 1 || src.quizAfter >= slides.length - 1) err(where, `"quizAfter" must be a slide index from 1 to ${slides.length - 2}`);
    quizAfter = src.quizAfter;
    midQuiz = arr(src, "midQuiz", where, 1, 3);
    endQuiz = arr(src, "endQuiz", where, 1, 3);
    checkQuiz(midQuiz, `${where} midQuiz`);
    checkQuiz(endQuiz, `${where} endQuiz`);
    const mix = (list, part) =>
      list.map((q, i) => {
        if (!Array.isArray(q?.options) || !isInt(q?.correct)) return q;
        const order = shuffled(q.options.map((_, k) => k), `${id}.${part}.${i}`);
        return { ...q, options: order.map((k) => q.options[k]), correct: order.indexOf(q.correct) };
      });
    midQuiz = mix(midQuiz, "mid");
    endQuiz = mix(endQuiz, "end");
  }
  return {
    id,
    module: moduleId,
    lesson: src.lesson,
    title: src.title,
    notes,
    quizAfter,
    slides: slides.map((s) => {
      const { sentences, ...rest } = s;
      return { ...rest, narration: (sentences ?? []).join(" "), sentences: sentences ?? [] };
    }),
    midQuiz,
    endQuiz,
  };
}

const videoMinutes = (v) => {
  const w = v.slides.reduce((n, s) => n + words(s.narration), 0);
  return Math.round(w / 150) + (v.midQuiz.length || v.endQuiz.length ? 1 : 0);
};

/* ------------------------------------------------------------------ pipelines */

function checkPipeline(p, where) {
  if (!p || typeof p !== "object") {
    err(where, "missing pipeline {nodes, edges}");
    return { ids: new Set(), edgeIds: new Set() };
  }
  const nodes = arr(p, "nodes", where, 2, 10);
  const edges = arr(p, "edges", where, 1, 14);
  const ids = new Set();
  nodes.forEach((n, k) => {
    const w = `${where} node ${k}`;
    allowedKeys(n, ["id", "kind", "label", "sub", "x", "y", "note"], w);
    if (!isStr(n?.id)) err(w, `"id" must be a string`);
    else if (ids.has(n.id)) err(w, `duplicate id "${n.id}"`);
    else ids.add(n.id);
    if (!NODE_KINDS.has(n?.kind)) err(w, `kind must be one of ${[...NODE_KINDS].join(", ")}`);
    str(n, "label", w, { max: 20 });
    str(n, "sub", w, { max: 26 });
    if (typeof n?.x !== "number" || n.x < 0 || n.x > 920) err(w, "x must be a number from 0 to 920");
    if (typeof n?.y !== "number" || n.y < 0 || n.y > 360) err(w, "y must be a number from 0 to 360");
  });
  // boxes are 196 x 68: two boxes must not overlap
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      const A = nodes[a];
      const B = nodes[b];
      if (A && B && Math.abs(A.x - B.x) < 204 && Math.abs(A.y - B.y) < 76) err(where, `nodes "${A.id}" and "${B.id}" overlap; space columns 230 apart and rows 110 apart`);
    }
  const edgeIds = new Set();
  edges.forEach((e, k) => {
    const w = `${where} edge ${k}`;
    allowedKeys(e, ["id", "source", "target"], w);
    if (!isStr(e?.id)) err(w, `"id" must be a string`);
    else if (edgeIds.has(e.id)) err(w, `duplicate id "${e.id}"`);
    else edgeIds.add(e.id);
    if (!ids.has(e?.source)) err(w, `source "${e?.source}" is not a node id`);
    if (!ids.has(e?.target)) err(w, `target "${e?.target}" is not a node id`);
  });
  return { ids, edgeIds };
}

function checkSteps(steps, refs, where, { allowShow }) {
  steps.forEach((s, k) => {
    const w = `${where} step ${k}`;
    allowedKeys(s, ["caption", "nodes", "edges", ...(allowShow ? ["show"] : [])], w);
    str(s, "caption", w, { max: 180 });
    for (const [id, st] of Object.entries(s?.nodes ?? {})) {
      if (!refs.ids.has(id)) err(w, `node "${id}" is not in the pipeline`);
      if (!STATES.has(st)) err(w, `state "${st}" must be idle, running, ok or error`);
    }
    for (const [id, st] of Object.entries(s?.edges ?? {})) {
      if (!refs.edgeIds.has(id)) err(w, `edge "${id}" is not in the pipeline`);
      if (!STATES.has(st)) err(w, `state "${st}" must be idle, running, ok or error`);
    }
    if (s?.show !== undefined) {
      if (!Array.isArray(s.show)) err(w, `"show" must be an array of node ids`);
      else for (const id of s.show) if (!refs.ids.has(id)) err(w, `show: "${id}" is not a node id`);
    }
  });
}

/** Cumulative step states -> full pipeline frames. */
function frames(pipeline, steps, { useShow }) {
  const nodeState = Object.fromEntries(pipeline.nodes.map((n) => [n.id, "idle"]));
  const edgeState = Object.fromEntries(pipeline.edges.map((e) => [e.id, "idle"]));
  const anyShow = useShow && steps.some((s) => Array.isArray(s.show));
  const visible = new Set(anyShow ? [] : pipeline.nodes.map((n) => n.id));
  return steps.map((s) => {
    Object.assign(nodeState, s.nodes ?? {});
    Object.assign(edgeState, s.edges ?? {});
    for (const id of s.show ?? []) visible.add(id);
    return {
      caption: s.caption,
      nodes: pipeline.nodes.filter((n) => visible.has(n.id)).map((n) => ({ id: n.id, kind: n.kind, label: n.label, sub: n.sub, x: n.x, y: n.y, state: nodeState[n.id] })),
      edges: pipeline.edges
        .filter((e) => visible.has(e.source) && visible.has(e.target))
        .map((e) => ({ id: e.id, source: e.source, target: e.target, state: edgeState[e.id] })),
    };
  });
}

const idle = (p) => ({
  nodes: p.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, sub: n.sub, x: n.x, y: n.y, state: "idle" })),
  edges: p.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, state: "idle" })),
});

const letters = "abcdefgh";

function mcOptions(opts, where, { min = 2, max = 4, rationale, whyKey, seed } = {}) {
  const list = Array.isArray(opts) ? opts : [];
  if (list.length < min || list.length > max) err(where, `needs ${min} to ${max} options`);
  const right = list.filter((o) => o?.correct === true).length;
  if (right !== 1) err(where, `exactly one option must have "correct": true (found ${right})`);
  return (seed ? shuffled(list, seed) : list).map((o, k) => {
    allowedKeys(o, ["text", "correct", ...(whyKey ? [whyKey] : [])], `${where} option ${k}`);
    str(o, "text", `${where} option ${k}`, { max: 160 });
    if (whyKey) str(o, whyKey, `${where} option ${k}`, { max: 260 });
    return { id: letters[k], text: o?.text ?? "", correct: o?.correct === true, rationale: whyKey ? o?.[whyKey] : rationale };
  });
}

/* ------------------------------------------------------------------ hook film */

/** Fields each film scene needs (see FilmShot in apps/web/src/data/types.ts). */
const SHOT_FIELDS = {
  "site-chat": ["url", "product", "asks", "reply", "count", "countLabel"],
  tickets: ["count", "subjects", "tag"],
  phone: ["time", "notes"],
  email: ["from", "address", "subject", "body", "meta", "replyBy", "reply", "highlight"],
  "doc-vs-reply": ["doc", "reply", "stamp"],
  "parcel-map": ["from", "to", "hub", "stop", "claim", "truth"],
  terminal: ["title", "lines"],
  "long-chat": ["customer", "agent", "messages", "key", "ask", "keep"],
  "test-grid": ["total", "passed", "countdown"],
  timelapse: ["startDay", "startTime", "hours", "amount", "steps", "error"],
  numbers: [],
};
const OPTIONAL_SHOT_FIELDS = { terminal: ["badge", "flood"] };
/** Scenes that wait for the learner: the ones with a button need `act` (its label); all of them need `then`. */
const ACT_TYPES = new Set(["tickets", "email", "parcel-map", "long-chat", "test-grid", "timelapse"]);
const THEN_TYPES = new Set([...ACT_TYPES, "site-chat", "doc-vs-reply"]);

function checkFilm(film, where) {
  const shots = arr(film, "shots", where, 2, 8);
  shots.forEach((s, i) => {
    const w = `${where} shot ${i} (${s?.type})`;
    const fields = SHOT_FIELDS[s?.type];
    if (!fields) return err(w, `unknown type; use one of ${Object.keys(SHOT_FIELDS).join(", ")}`);
    const acts = ACT_TYPES.has(s.type);
    const thens = THEN_TYPES.has(s.type);
    allowedKeys(s, ["type", "label", "say", ...(acts ? ["act"] : []), ...(thens ? ["then"] : []), ...fields, ...(OPTIONAL_SHOT_FIELDS[s.type] ?? [])], w);
    str(s, "label", w, { max: 48 });
    // spoken, and shown as the caption: one breath, no codes or ids the voice would spell out
    str(s, "say", w, { max: 110 });
    if (acts) str(s, "act", w, { max: 34 });
    if (thens) str(s, "then", w, { max: 110 });
    for (const k of ["say", "then"]) if (/[A-Z]{2,}-\d|_|\$\d/.test(s[k] ?? "")) warn(w, `"${k}" is spoken; write ids, code and amounts as words`);
    for (const f of fields) if (s[f] === undefined || s[f] === null || s[f] === "") err(w, `missing "${f}"`);
    if (s.type === "site-chat" && !(Array.isArray(s.asks) && s.asks.length >= 3)) err(w, "needs at least 3 asks: the learner sends the first three");
    if (s.type === "phone") {
      const notes = arr(s, "notes", w, 1, 3);
      notes.forEach((m, k) => {
        allowedKeys(m, ["who", "av", "at", "text"], `${w} note ${k}`);
        for (const f of ["who", "av", "at"]) str(m, f, `${w} note ${k}`);
        str(m, "text", `${w} note ${k}`, { max: 110 });
      });
    }
    if (s.type === "doc-vs-reply" && s.reply?.text && !s.reply.text.includes(s.reply.highlight)) err(w, "reply.highlight must appear in reply.text: it is what the learner taps");
    if (s.type === "long-chat" && Array.isArray(s.messages)) {
      if (!(s.key < s.ask && s.ask < s.messages.length)) err(w, `need key < ask < ${s.messages.length} (message indexes, 0-based)`);
    }
    if (s.type === "test-grid" && !(s.passed <= s.total)) err(w, "passed cannot be more than total");
    if (s.type === "parcel-map" && !(s.stop > 0 && s.stop < 1)) err(w, "stop must be between 0 and 1");
  });
}

/* ------------------------------------------------------------------ module blocks */

function buildModule(spine, mi) {
  const mod = spine.modules[mi];
  const N = mi + 1;
  const mid = mod.module_id;
  const dir = path.join(SRC, mid);
  const lessonIds = mod.lessons.map((l) => l.id);
  const objective_ids = lessonIds.map((l) => `obj-${l}`);
  const base = (stage, step, duration_min, bloom, load = "medium") => ({ step_id: `${mid}.${step}`, stage, duration_min, bloom, load, objective_ids });

  // videos
  const videos = mod.lessons.map((l, k) => {
    const file = path.join(dir, `video-${l.id}.json`);
    const where = `${mid}/video-${l.id}.json`;
    const src = readJson(file, where);
    if (src && src.lesson !== l.id) err(where, `"lesson" is "${src.lesson}" but the file is for lesson ${l.id}`);
    if (src && src.title !== l.title) warn(where, `title "${src.title}" differs from the course outline's "${l.title}"`);
    return buildVideo(src, `${mid}-${k + 1}`, mid, where);
  });

  const where = `${mid}/blocks.json`;
  const src = readJson(path.join(dir, "blocks.json"), where) ?? {};
  allowedKeys(src, ["hook", "worked", "guided", "lab", "review"], where);
  const topic = (stage) => mod.topics.find((t) => t.stage === stage)?.title;

  /* hook */
  const h = src.hook ?? {};
  const wh = `${where} hook`;
  if (!src.hook) err(where, "missing hook");
  allowedKeys(h, ["kicker", "title", "why", "stat", "narration", "messages", "prompt", "hunches", "correct", "pipeline", "reveal", "wrap_correct", "wrap_wrong", "wrap_point", "film"], wh);
  if (h.film !== undefined) checkFilm(h.film, `${wh} film`);
  for (const k of ["kicker", "title", "why", "stat", "narration", "prompt", "wrap_correct", "wrap_wrong", "wrap_point"]) str(h, k, wh);
  if (h.title && h.title !== topic("hook")) warn(wh, `title differs from the topic title "${topic("hook")}"`);
  const msgs = arr(h, "messages", wh, 2, 5);
  msgs.forEach((m, k) => {
    allowedKeys(m, ["who", "av", "at", "text"], `${wh} message ${k}`);
    for (const f of ["who", "av", "at", "text"]) str(m, f, `${wh} message ${k}`);
  });
  const hunches = arr(h, "hunches", wh, 3, 4);
  const hunchIds = new Set(hunches.map((x) => x?.id));
  hunches.forEach((x, k) => {
    str(x, "id", `${wh} hunch ${k}`);
    str(x, "label", `${wh} hunch ${k}`, { max: 80 });
  });
  if (!hunchIds.has(h.correct)) err(wh, `"correct" must be one of the hunch ids`);
  const hp = checkPipeline(h.pipeline, `${wh} pipeline`);
  const reveal = h.reveal ?? {};
  str(reveal, "narration", `${wh} reveal`);
  const rsteps = arr(reveal, "steps", `${wh} reveal`, 3, 10);
  checkSteps(rsteps, hp, `${wh} reveal`, { allowShow: false });
  let hook = null;
  if (h.pipeline?.nodes && h.pipeline?.edges) {
    const fr = frames(h.pipeline, rsteps, { useShow: false });
    hook = {
      ...base("hook", "hook", 4, "understand", "low"),
      kicker: h.kicker,
      title: h.title,
      narration: h.narration,
      why: h.why,
      stat: h.stat,
      messages: h.messages,
      prompt: h.prompt,
      hunches: shuffled(h.hunches, `${mid}.hook`),
      correct: h.correct,
      pipeline: idle(h.pipeline),
      reveal: { narration: reveal.narration, frames: fr, timeline: fr.map((f, i) => ({ t: i * 1700, ...f })) },
      wrap_correct: h.wrap_correct,
      wrap_wrong: h.wrap_wrong,
      wrap_point: h.wrap_point,
      ...(h.film ? { film: h.film } : {}),
    };
  }

  /* worked */
  const wk = src.worked ?? {};
  const ww = `${where} worked`;
  if (!src.worked) err(where, "missing worked");
  const exs = arr(wk, "examples", ww, 2, 3);
  const examples = exs.map((e, k) => {
    const we = `${ww} example ${k}`;
    allowedKeys(e, ["lesson", "title", "intro", "narration", "predict", "pipeline", "steps"], we);
    if (!lessonIds.includes(e?.lesson)) err(we, `lesson "${e?.lesson}" is not one of ${lessonIds.join(", ")}`);
    for (const f of ["title", "intro", "narration"]) str(e, f, we);
    let predict = null;
    if (e?.predict) {
      allowedKeys(e.predict, ["stem", "options", "rationale"], `${we} predict`);
      str(e.predict, "stem", `${we} predict`);
      str(e.predict, "rationale", `${we} predict`);
      predict = {
        step_id: `${mid}.worked.${k + 1}.predict`,
        kind: "mc",
        stem: e.predict.stem,
        options: mcOptions(e.predict.options, `${we} predict`, { min: 2, max: 4, rationale: e.predict.rationale, seed: `${mid}.worked.${k + 1}` }),
        hints: [],
      };
    }
    const refs = checkPipeline(e?.pipeline, `${we} pipeline`);
    const st = arr(e, "steps", we, 3, 9);
    checkSteps(st, refs, we, { allowShow: true });
    return {
      step_id: `${mid}.worked.${k + 1}`,
      lesson: e?.lesson,
      title: e?.title,
      intro: e?.intro,
      narration: e?.narration,
      predict,
      frames: e?.pipeline?.nodes && e?.pipeline?.edges ? frames(e.pipeline, st, { useShow: true }) : [],
    };
  });
  const workedMin = Math.max(8, Math.round(examples.reduce((n, e) => n + 3 + e.frames.length * 0.6, 0)));
  const worked = { ...base("worked", "worked", workedMin, "apply", "low"), examples };

  /* guided */
  const g = src.guided ?? {};
  const wg = `${where} guided`;
  if (!src.guided) err(where, "missing guided");
  allowedKeys(g, ["title", "situation", "intro", "before", "steps", "finish"], wg);
  for (const f of ["title", "situation", "intro"]) str(g, f, wg);
  if (g.title && g.title !== topic("guided")) warn(wg, `title differs from the topic title "${topic("guided")}"`);
  arr(g.before ?? {}, "items", `${wg} before`, 1, 6);
  if (g.before && !Array.isArray(g.before.downloads)) err(`${wg} before`, `"downloads" must be an array (it can be empty)`);
  const gsteps = arr(g, "steps", wg, 4, 10);
  gsteps.forEach((s, k) => {
    const w = `${wg} step ${k}`;
    allowedKeys(s, ["title", "body", "actions", "values", "check", "tip"], w);
    for (const f of ["title", "body", "check"]) str(s, f, w);
    arr(s, "actions", w, 1, 8).forEach((a, j) => isStr(a) || err(`${w} action ${j}`, "must be a string"));
    if (s?.values !== undefined)
      (Array.isArray(s.values) ? s.values : []).forEach((v, j) => {
        str(v, "label", `${w} value ${j}`);
        str(v, "value", `${w} value ${j}`);
      });
    if (s?.tip !== undefined) str(s, "tip", w);
  });
  const fin = g.finish ?? {};
  str(fin, "title", `${wg} finish`);
  str(fin, "body", `${wg} finish`);
  arr(fin, "checklist", `${wg} finish`, 2, 6);
  const guided = {
    ...base("guided", "guided", Math.max(15, gsteps.length * 3), "apply"),
    title: g.title,
    situation: g.situation,
    intro: g.intro,
    before: { items: g.before?.items ?? [], downloads: g.before?.downloads ?? [] },
    steps: gsteps.map((s, k) => ({ id: `s${k + 1}`, ...s })),
    finish: fin,
  };

  /* lab (scenarios) */
  const lb = src.lab ?? {};
  const wl = `${where} lab`;
  if (!src.lab) err(where, "missing lab");
  allowedKeys(lb, ["title", "intro", "scenarios"], wl);
  str(lb, "title", wl);
  str(lb, "intro", wl);
  if (lb.title && lb.title !== topic("lab")) warn(wl, `title differs from the topic title "${topic("lab")}"`);
  const scen = arr(lb, "scenarios", wl, 3, 3);
  const scenLessons = new Set();
  const scenarios = scen.map((s, k) => {
    const w = `${wl} scenario ${k}`;
    allowedKeys(s, ["lesson", "title", "situation", "context", "stem", "options", "hints", "debrief"], w);
    if (!lessonIds.includes(s?.lesson)) err(w, `lesson "${s?.lesson}" is not one of ${lessonIds.join(", ")}`);
    scenLessons.add(s?.lesson);
    for (const f of ["title", "situation", "stem", "debrief"]) str(s, f, w);
    if (s?.context) {
      str(s.context, "label", `${w} context`);
      arr(s.context, "lines", `${w} context`, 1, 14);
    }
    if (s?.hints !== undefined && !Array.isArray(s.hints)) err(w, `"hints" must be an array`);
    return {
      id: `${mid}.lab.${k + 1}`,
      lesson: s?.lesson,
      title: s?.title,
      situation: s?.situation,
      ...(s?.context ? { context: s.context } : {}),
      question: {
        step_id: `${mid}.lab.${k + 1}.q`,
        kind: "mc",
        stem: s?.stem,
        options: mcOptions(s?.options, w, { min: 3, max: 4, whyKey: "why", seed: `${mid}.lab.${k + 1}` }),
        hints: s?.hints ?? [],
      },
      debrief: s?.debrief,
    };
  });
  if (scen.length && scenLessons.size < 2) warn(wl, "all scenarios use one lesson; cover at least two");
  const lab = { ...base("lab", "lab", scen.length * 3 + 1, "analyze"), title: lb.title, intro: lb.intro, scenarios };

  /* review */
  const rv = src.review ?? {};
  const wr = `${where} review`;
  if (!src.review) err(where, "missing review");
  const vars = arr(rv, "variants", wr, 3, 3);
  const variants = vars.map((v, k) => {
    const w = `${wr} variant ${k}`;
    allowedKeys(v, ["after_days", "title", "stem", "options", "rationale"], w);
    if (!isInt(v?.after_days)) err(w, `"after_days" must be a whole number`);
    for (const f of ["title", "stem", "rationale"]) str(v, f, w);
    return {
      id: `v${k + 1}`,
      title: v?.title,
      after_days: v?.after_days,
      stem: v?.stem,
      options: mcOptions(v?.options, w, { min: 3, max: 4, rationale: v?.rationale, seed: `${mid}.review.${k + 1}` }),
    };
  });
  const review = {
    ...base("review", "review", 5, "apply", "low"),
    schedule: variants.map((v, k) => ({ review: k + 1, after_days: v.after_days })),
    variants,
  };

  /* module check: the assessment that closes the module, one question per lesson plus a scenario */
  const gateCheck = buildModuleCheck(mod, mid, dir, lessonIds, base);

  /* explainer: the videos are attached by apps/web/src/data/index.ts */
  const built = videos.filter(Boolean);
  const explainMin = built.reduce((n, v) => n + videoMinutes(v), 0);
  const explainer = { ...base("explainer", "explain", explainMin, "understand"), concepts: [], segments: [] };

  const blocks = [hook, explainer, worked, guided, lab, gateCheck?.block, review].filter(Boolean);
  const minutes = blocks.reduce((n, b) => n + b.duration_min, 0);
  return {
    videos: built,
    minutes,
    notes: Object.fromEntries(built.map((v) => [v.lesson, v.notes])),
    check: gateCheck,
    content: {
      $comment: "Generated by fixtures/scripts/build-ai-agent.mjs from fixtures/src/ai-agent. Edit the source, not this file.",
      course_id: spine.course_id,
      course_title: spine.title,
      module_id: mid,
      version: "1.0.0",
      locale: "en",
      title: mod.title,
      summary: mod.pain,
      estimated_minutes: minutes,
      stages_included: blocks.map((b) => b.stage),
      metadata: { objectives: mod.lessons.map((l) => ({ id: `obj-${l.id}`, text: l.title, lesson: l.id })) },
      blocks,
    },
  };
}

/**
 * mN/assessment.json -> the module's closing check (a gate block), its answer
 * key, and its topic for the course outline. Graded like the final check, but
 * only the overall 80% counts: with one question per lesson, a single slip on
 * one lesson must not fail the module. Returns null while the file is absent.
 */
function buildModuleCheck(mod, mid, dir, lessonIds, base) {
  const file = path.join(dir, "assessment.json");
  if (!fs.existsSync(file)) return null;
  const wa = `${mid}/assessment.json`;
  const a = readJson(file, wa) ?? {};
  allowedKeys(a, ["title", "summary", "items"], wa);
  str(a, "title", wa, { max: 60 });
  str(a, "summary", wa, { max: 140 });
  const keys = {};
  const explain = {};
  const items = arr(a, "items", wa, 5, 8).map((it, k) => {
    const w = `${wa} item ${k}`;
    allowedKeys(it, ["lesson", "stem", "options", "correct", "explain", "transfer"], w);
    if (!lessonIds.includes(it?.lesson)) err(w, `lesson "${it?.lesson}" is not one of ${lessonIds.join(", ")}`);
    str(it, "stem", w, { max: 260 });
    const opts = arr(it, "options", w, 4, 4);
    opts.forEach((o, j) => (isStr(o) ? o.length > 120 && warn(`${w} option ${j}`, `is ${o.length} characters; keep it under 120`) : err(`${w} option ${j}`, "must be a string")));
    if (!isInt(it?.correct) || it.correct < 0 || it.correct > 3) err(w, `"correct" must be 0 to 3`);
    str(it, "explain", w, { max: 300 });
    // authors tend to put the right answer in the same place, and a shuffle of six can still bunch:
    // rotate the right answer through every position (a d c b a d…, offset per module), the rest shuffled
    const tagged = opts.map((text, j) => ({ text, right: j === it?.correct }));
    const order = shuffled(tagged.filter((o) => !o.right), `${mid}.gate.${k + 1}`);
    order.splice((k * 3 + Number(mid.replace(/\D/g, "") || 0)) % 4, 0, ...tagged.filter((o) => o.right));
    const id = `q${k + 1}`;
    keys[id] = letters[Math.max(0, order.findIndex((o) => o.right))];
    explain[id] = it?.explain;
    return {
      id,
      objective_id: `obj-${it?.lesson}`,
      kind: "mc",
      stem: it?.stem,
      options: order.map((o, j) => ({ id: letters[j], text: o.text })),
      lessons: [it?.lesson],
      ...(it?.transfer ? { transfer: true } : {}),
    };
  });
  for (const l of lessonIds) if (!items.some((i) => i.objective_id === `obj-${l}`)) err(wa, `no question tests lesson ${l}`);
  const objectives = lessonIds.map((l) => `obj-${l}`);
  return {
    block: {
      ...base("gate", "gate", Math.max(5, Math.round(items.length * 1.5)), "apply"),
      pass_threshold: 0.8,
      min_correct_per_objective: 0,
      retry_policy: { wait_hours: 0, new_variants: false },
      item_count: items.length,
      objectives_tested: objectives,
      items,
      // a missed lesson points back to its own video
      remediation: Object.fromEntries(mod.lessons.map((l) => [`obj-${l.id}`, { label: `Rewatch ${l.id} “${l.title}”`, step_id: `${mid}.explain.${l.id}` }])),
    },
    topic: { stage: "gate", title: a.title, summary: a.summary },
    keys,
    explain,
  };
}

/* ------------------------------------------------------------------ course-level files */

function buildPrecheck(spine) {
  const where = "precheck.json";
  const src = readJson(path.join(SRC, "precheck.json"), where);
  if (!src) return null;
  const items = arr(src, "items", where, 10, 12);
  const keys = {};
  const perModule = {};
  const out = items.map((it, k) => {
    const w = `${where} item ${k}`;
    allowedKeys(it, ["module", "stem", "options", "correct"], w);
    const mi = spine.modules.findIndex((m) => m.module_id === it?.module);
    if (mi < 0) err(w, `module "${it?.module}" is not m1 to m6`);
    perModule[it?.module] = (perModule[it?.module] ?? 0) + 1;
    str(it, "stem", w, { max: 180 });
    const opts = arr(it, "options", w, 3, 3);
    if (!isInt(it?.correct) || it.correct < 0 || it.correct > 2) err(w, `"correct" must be 0, 1 or 2`);
    const id = `p${k + 1}`;
    const order = shuffled(opts.map((_, j) => j), `precheck.${id}`);
    keys[id] = letters[order.indexOf(it?.correct ?? 0)];
    // the check sets support per module, so every lesson of the module shares it
    return { id, lesson: String(mi + 1), module: it?.module, stem: it?.stem, options: order.map((j, pos) => ({ id: letters[pos], text: opts[j] })) };
  });
  for (const m of spine.modules) if ((perModule[m.module_id] ?? 0) !== 2) warn(where, `${m.module_id} has ${perModule[m.module_id] ?? 0} questions; aim for 2 per module`);
  return { file: { $comment: "Generated. Ungraded check of prior knowledge before Module 1; each item's lesson is its module number, so support is set module by module.", course_id: spine.course_id, version: "1.0.0", items: out }, keys };
}

function buildFinale(spine) {
  const where = "finale.json";
  const src = readJson(path.join(SRC, "finale.json"), where);
  if (!src) return null;
  allowedKeys(src, ["capstone", "final", "wrap_up"], where);
  const objectives = spine.modules.map((m, i) => ({ id: `obj-${m.module_id}`, text: `Module ${i + 1} · ${m.title}`, lesson: String(i + 1) }));
  const cap = src.capstone ?? {};
  const wc = `${where} capstone`;
  allowedKeys(cap, ["kicker", "title", "project_name", "scene", "requirements", "edge_cases", "closing", "reactions"], wc);
  for (const f of ["kicker", "title", "project_name", "scene", "closing"]) str(cap, f, wc);
  const reqs = arr(cap, "requirements", wc, 4, 10);
  arr(cap, "edge_cases", wc, 0, 8);
  arr(cap, "reactions", wc, 0, 4).forEach((r, k) => ["who", "av", "text"].forEach((f) => str(r, f, `${wc} reaction ${k}`)));
  const step = spine.finale.steps.find((s) => s.id === "capstone");
  const capstone = {
    step_id: "finale.capstone",
    duration_min: step?.minutes ?? 120,
    kicker: cap.kicker,
    title: cap.title,
    project_name: cap.project_name,
    scene: cap.scene,
    requirements: reqs.map((t, k) => ({ id: `r${k + 1}`, text: t })),
    edge_cases: cap.edge_cases ?? [],
    closing: cap.closing,
    reactions: cap.reactions ?? [],
  };

  const fsrc = src.final ?? {};
  const wf = `${where} final`;
  const items = arr(fsrc, "items", wf, 12, 12);
  const keys = {};
  const explain = {};
  const gateItems = items.map((it, k) => {
    const w = `${wf} item ${k}`;
    allowedKeys(it, ["module", "stem", "options", "correct", "explain", "lessons", "transfer"], w);
    if (!spine.modules.some((m) => m.module_id === it?.module)) err(w, `module "${it?.module}" is not m1 to m6`);
    str(it, "stem", w, { max: 260 });
    const opts = arr(it, "options", w, 4, 4);
    if (!isInt(it?.correct) || it.correct < 0 || it.correct > 3) err(w, `"correct" must be 0 to 3`);
    str(it, "explain", w, { max: 300 });
    const id = `f${k + 1}`;
    keys[id] = letters[it?.correct ?? 0];
    explain[id] = it?.explain;
    return {
      id,
      objective_id: `obj-${it?.module}`,
      kind: "mc",
      stem: it?.stem,
      options: opts.map((t, j) => ({ id: letters[j], text: t })),
      ...(it?.lessons ? { lessons: it.lessons } : {}),
      ...(it?.transfer ? { transfer: true } : {}),
    };
  });
  const objIds = objectives.map((o) => o.id);
  for (const o of objIds) if (!gateItems.some((g) => g.objective_id === o)) err(wf, `no question tests ${o}; ask 2 per module`);
  const gstep = spine.finale.steps.find((s) => s.id === "final-check");
  const final = {
    step_id: "finale.final",
    stage: "gate",
    duration_min: gstep?.minutes ?? 20,
    bloom: "analyze",
    load: "medium",
    objective_ids: objIds,
    pass_threshold: 0.8,
    min_correct_per_objective: 1,
    retry_policy: { wait_hours: 0, new_variants: false },
    item_count: gateItems.length,
    objectives_tested: objIds,
    items: gateItems,
    remediation: Object.fromEntries(spine.modules.map((m) => [`obj-${m.module_id}`, { label: `Revisit “${m.title}”`, step_id: `${m.module_id}.explain` }])),
  };

  const wu = src.wrap_up ?? {};
  const ww = `${where} wrap_up`;
  const prompts = arr(wu, "prompts", ww, 3, 3);
  prompts.forEach((p, k) => {
    if (!["worked", "failed", "transfers"].includes(p?.kind)) err(`${ww} prompt ${k}`, `kind must be worked, failed or transfers`);
    str(p, "text", `${ww} prompt ${k}`);
  });
  const rstep = spine.finale.steps.find((s) => s.id === "wrap-up");
  const wrap_up = {
    step_id: "finale.wrapup",
    duration_min: rstep?.minutes ?? 10,
    min_sentences: isInt(wu.min_sentences) ? wu.min_sentences : 2,
    prompts: prompts.map((p, k) => ({ id: `w${k + 1}`, kind: p.kind, text: p.text })),
  };
  return {
    file: { $comment: "Generated. Answer keys live in mock-gate-keys.json.", course_id: spine.course_id, version: "1.0.0", objectives, capstone, final, wrap_up },
    keys,
    explain,
  };
}

/* ------------------------------------------------------------------ main */

const spine = readJson(path.join(SRC, "course.json"), "course.json");
if (!spine) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const moduleIdx = COURSE_ONLY ? [] : spine.modules.map((_, i) => i).filter((i) => !ONLY || spine.modules[i].module_id === ONLY);
if (ONLY && !moduleIdx.length) {
  console.error(`No module "${ONLY}" in course.json`);
  process.exit(1);
}
const built = moduleIdx.map((i) => buildModule(spine, i));

let intro = null;
let precheck = null;
let finale = null;
if (!ONLY) {
  intro = buildVideo(readJson(path.join(SRC, "intro.json"), "intro.json"), "ai-agent-intro", "intro", "intro.json", { quizzes: false });
  precheck = buildPrecheck(spine);
  finale = buildFinale(spine);
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`ERROR    ${e}`);
const slides = built.reduce((n, b) => n + b.videos.reduce((k, v) => k + v.slides.length, 0), 0);
console.log(`\n${built.length} module(s), ${built.reduce((n, b) => n + b.videos.length, 0)} videos, ${slides} slides · ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) process.exit(1);
if (CHECK || ONLY) {
  console.log("OK (nothing written)");
  process.exit(0);
}

/* write */
const write = (name, data) => fs.writeFileSync(path.join(FIX, name), JSON.stringify(data, null, 2) + "\n");

const course = {
  ...Object.fromEntries(Object.entries(spine).filter(([k]) => !k.startsWith("$"))),
  modules: spine.modules.map((m, i) => {
    // the module check closes the module, just before the spaced review that follows it over the weeks
    const check = built[i].check;
    const beforeReview = (list, x, isReview) => {
      const at = list.findIndex(isReview);
      return at < 0 ? [...list, x] : [...list.slice(0, at), x, ...list.slice(at)];
    };
    return {
      ...m,
      ...(check
        ? {
            stages: beforeReview(m.stages, "gate", (s) => s === "review"),
            topics: beforeReview(m.topics, check.topic, (t) => t.stage === "review"),
          }
        : {}),
      minutes: built[i].minutes,
      lessons: m.lessons.map((l) => ({ ...l, notes: built[i].notes[l.id] ?? [] })),
    };
  }),
};
write("courses.json", { $comment: "Generated by fixtures/scripts/build-ai-agent.mjs from fixtures/src/ai-agent/course.json.", courses: [course] });
built.forEach((b, i) => write(`module-ai-agent-${spine.modules[i].module_id}.json`, b.content));
write("videos-ai-agent.json", { $comment: "Generated. Narration audio: apps/web/public/audio/video-{id}-s{n}.mp3", course_id: spine.course_id, videos: built.flatMap((b) => b.videos) });
write("intro-ai-agent.json", { $comment: "Generated. The course preview video shown while enrolling.", course_id: spine.course_id, video: intro });
write("precheck-ai-agent.json", precheck.file);
write("finale-ai-agent.json", finale.file);
write("mock-gate-keys.json", {
  $comment: "MOCK ONLY. Generated. Stands in for server-side scoring; never ship keys to the client in production. Keys per check: final (final-assessment answers), final_explain (why each answer is right), precheck (prior-knowledge answers), gate-mN and gate-mN_explain (each module's closing check).",
  final: finale.keys,
  final_explain: finale.explain,
  precheck: precheck.keys,
  ...Object.fromEntries(
    built.flatMap((b, i) => (b.check ? [[`gate-${spine.modules[i].module_id}`, b.check.keys], [`gate-${spine.modules[i].module_id}_explain`, b.check.explain]] : [])),
  ),
});
console.log("Wrote courses.json, module-ai-agent-m1..m6.json, videos-ai-agent.json, intro-ai-agent.json, precheck-ai-agent.json, finale-ai-agent.json, mock-gate-keys.json");
