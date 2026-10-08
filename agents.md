# agents.md — Guide for AI coding agents

Instructions for AI agents (and humans) working in this repository. Read this before changing code.

## What this repo is

**Nebula KnowLab** (package name `proofcraft`) — a client-side-only LMS prototype built with **React 19 + Vite 6**. It teaches n8n workflow automation through a fictional company ("Nebula", a D2C coffee subscription). There is **no backend**: all state lives in the browser (Zustand + localStorage persistence), all content lives in JS modules.

Two other top-level folders exist:

- `lms-feature/` — **the app**. Almost all work happens here.
- `forma/` — a static HTML design reference (light-theme LMS template). Do not treat it as app code.
- `docs/` — project documentation (`architecture.md`, `design.md`, `Systemdesign.md`, `backend-plan.md`, this file).

## Commands

Run everything from `lms-feature/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 (hot reload) |
| `npm run build` | Production build into `dist/` — use this to verify changes compile |
| `npm run preview` | Serve the production build |
| `npm run audio` | Regenerate narration MP3s (needs Python + `edge-tts` + internet; **rarely needed** — clips are committed in `public/audio/`) |

There is **no test runner configured**. Verify changes with `npm run build` and by exercising the affected flow in the dev server. Suggested manual smoke path: landing → onboarding → precheck → module player → quiz → capstone → final.

## Repo layout (app)

```
lms-feature/src/
  main.jsx            entry: router + ReactFlow provider + ErrorBoundary
  App.jsx             route table + top nav + page transitions + PatchDock
  index.css           the entire design system (tokens + all component CSS)
  motion.js           shared animation variants
  content/            the COURSE — hand-written data, not code logic
    course.js         course meta, module spine, final-assessment questions+answers
    modules/m1–m4.js  per-module lesson content (beats, scenarios, quizzes)
    videos/*.js       video-lesson scripts
    world.js          domain rewrites ("in your world" cards), roles
    profile.js        onboarding questionnaire definition
    catalog.js, capstone.js, session.js, audio.js
  engine/             PURE FUNCTIONS ONLY — no React, no stores
    adaptive.js       adaptation rules (support level, lesson ordering, analogies)
    progress.js       stage lists, unlocking, resume point, course step
    plan.js           learning-plan scheduling (sessions, days)
    linter.js         workflow-linter scoring for portfolio artifacts
  stores/             Zustand stores (7) — the whole app state
    learner.js  course.js  plan.js  portfolio.js  review.js  signals.js  patch.js
  pages/              route-level screens (Landing, Onboarding, Dashboard, Course, …)
  player/             Player.jsx (stage sequencer) + Recap.jsx
  stages/             one component per lesson stage kind (hook, explain, worked, …)
  canvas/             n8n-style workflow canvas (React Flow) + narration/TTS
  ui/                 shared components (TopNav, GlassCard, bits, ModuleRail, …)
  patch/              "Patch" assistant: deterministic knowledge base + chat dock
  video/              VideoLesson + Slide
public/audio/          pre-generated narration MP3s (do not regenerate casually)
```

## Hard rules

1. **Stage keys are forever.** Progress is saved under keys like `hook`, `1.1-explain`, `1.1-worked`, `guided`, `quiz`. Reordering lessons must never change a key (`engine/progress.js` enforces this). If you add a stage kind, add it in `engine/progress.js` stage lists, `player/Player.jsx` `KIND`, and a component in `stages/`.

2. **Persisted stores are versioned.** `learner.js`, `course.js`, `plan.js`, `portfolio.js`, `review.js`, `signals.js` use `persist` with a `version` and a `migrate()` function. Any shape change ⇒ bump `version` AND write a migration. Never break existing learners' saved state. Un-persisted: `patch.js`.

3. **Keep the engine pure.** `engine/*.js` must stay free of React and store imports (they may import `content/` for read-only metadata). Adaptivity logic belongs there as pure functions so it can be ported/audited (see `docs/backend-plan.md` — the plan ports these to Python).

4. **Demo mode is sacred.** `learner.demoMode` unlocks everything and the whole app must work with zero network and no accounts. Don't add hard dependencies on external services at runtime.

5. **Quiz/final answers live in content files** (`course.js`, `modules/*.js`) for now — that's acceptable for the demo but is a known limitation; the backend plan moves them server-side. Don't "clean them up" client-side without coordinating with that plan.

6. **No CSS framework.** Styling is hand-written CSS in `src/index.css` using the token layer (`--bg`, `--accent`, `--fs-*`, `--s*`, `--r*`…). Use tokens, never raw hex values, in new CSS. See `docs/design.md`.

7. **Accessibility is a feature, not a patch.** Respect `adapt.reduceMotion` (via `MotionConfig`) and `adapt.textScale`; visible `:focus-visible` outlines; contrast-tested muted colors. If you add motion, register it with the reduced-motion path.

8. **Content edits are data edits.** When adding lessons/questions, follow the exact shapes in `content/course.js` (`MODULES`, `submodules`, `final.questions`) and `content/modules/*.js`. Narration references must point at existing files in `public/audio/`.

9. **Canvas = React Flow.** The n8n simulation lives in `canvas/N8nCanvas.jsx` on `@xyflow/react`. Node types via `CanvasNode`/`NodeIcon`; narration via `useNarration` + `tts.js`. Don't introduce a second diagram library.

10. **Windows environment.** Paths in scripts may need quoting; prefer cross-platform Node APIs over shell one-liners in any tooling you add.

## Conventions

- **JSX + plain JS** (no TypeScript). Keep it that way unless the team decides otherwise.
- **One component per file**, named exports default. UI primitives in `ui/bits.jsx` (`Btn`, `Chip`, …) — reuse before creating new ones.
- **Comments explain *why***, often with product intent — preserve them when editing; they encode design decisions (e.g., "never framed as levels or scores to the learner").
- **Naming:** stores `useXxx`, engine functions pure verbs (`resumePoint`, `isUnlocked`), stage kinds lowercase (`explain`, `worked`, `scenarios`).
- Routes are declared in one array in `App.jsx`; add new screens there.

## When to update docs

Change behavior ⇒ update the matching doc in the same PR:

- App/state/architecture changes → `docs/architecture.md`
- Visual/tokens/components → `docs/design.md`
- Anything touching the target system design → `docs/Systemdesign.md` (+ `docs/backend-plan.md` for backend scope)
- New agent-facing conventions → this file

## Known sharp edges

- `learner.js` has a non-trivial `migrate()` (v0–v3 history: name moved to account, per-module prechecks merged into one). Read it before touching profile/precheck shapes.
- `engine/progress.js` and `player/Player.jsx` both encode stage ordering — they are intentionally kept in sync via `stageList()`. Change it in one place only.
- The final assessment "never adapts" by product rule — do not wire it into the adaptation engine.
- `signals.js` data is telemetry-like and must never surface to learners as scores or levels (product promise).
