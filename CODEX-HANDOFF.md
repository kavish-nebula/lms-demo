# Codex handoff: Nebula KnowLab (adaptive AI course)

Start here. This file sums up what was built in the Claude Code sessions of 2026-10-16 and 2026-10-17, how it fits together, and what is still open.

> **Note:** the root `agents.md` / `AGENTS.md` describes an **older Vite + JSX app** (`lms-feature/`, Zustand, no backend). **That is out of date.** The real app is the Next.js monorepo described below. Use `agents.md` only for its general spirit: keep the engine pure, don't break saved data, accessibility matters, and explain *why* in comments.

---

## 1. What the product is

Nebula KnowLab is an **adaptive, AI-powered LMS**. The current course is **"Build Your First AI Agent"** (6 modules). The **core concepts stay the same for everyone.** What adapts to the learner is the setup flow, the examples, the activity and the voice.

**Journey:** enrol, then **About you** (live profiling), then **preview video**, then **The Mission** (prior-knowledge activity), then **Your plan** (customise), then **Build**, then **modules**.

- **Each module's parts:** hook, explainer, worked, guided, lab, gate, review.
- **A companion goes along the whole way:** the learner's own agent, voiced and "built along". It says where the learner is and why.

### What the user wants (keep these in mind)
- **Short, simple text everywhere.** Use plain everyday English, short sentences and no jargon.
- **Content edits: Module 1 only** for now. Modules 2–6 stay as they are.
- **Don't change narrated fields** (slide sentences, hook film say/then, replay captions, roleplay narration): pre-made MP3 clips match them.
- **Adapt the content, not the format or time.** The questions about learning format and weekly time were dropped on purpose.
- **No idle waits and no static "slides that just read text".** Waits should show progress or something engaging.
- **Match the audience's tone:** no heavy gamification for senior professionals.
- **Orientation through "Your agent, built along",** NOT a feature-explaining tour bot. A spotlight tour was built and then removed because the user found it dull.

---

## 2. Run it

```bash
npm install
npm run dev          # http://localhost:3000  (Next.js 16, Turbopack)
```

- **Typecheck:** `npm run typecheck` (or `npx tsc --noEmit -p apps/web`).
- **Lint:** `npm run lint`.
- **Tests:** `node --test apps/web/tests/learning-experience.test.cjs`. All **40** pass. They cover profiling, mission scoring, `alignOptions`, the agent build, companion lines and transcripts.
  - The backend test runner fails in this folder because the folder name has a space, "(3)" (the path gets %20-encoded). This is not caused by the code changes.
- **Course content source:** `fixtures/src/ai-agent/`. Rebuild it with `node fixtures/scripts/build-ai-agent.mjs`.
- **UI text:** `packages/i18n/en.json` (next-intl). This file uses **CRLF line endings**, so keep them.
- **Env:** `apps/web/.env.local`, documented in `apps/web/.env.example`.
  - **Never print, commit or zip `GEMINI_API_KEY`.**

```
GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash      (main)
# GEMINI_FAST_MODEL=gemini-3.1-flash-lite,gemini-3.5-flash-lite                         (fast)
# GEMINI_STRONG_MODEL=gemini-3.1-pro-preview,gemini-3.6-flash
# GEMINI_CODE_MODEL=gemini-3.8-flash
# GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1,gemini-3.1-flash-image,gemini-3.1-flash-lite-image
VOICE_PROVIDER=kokoro          # kokoro (local, default) | gemini
# KOKORO_DTYPE=q8              # q8 smaller/faster; fp32 best quality
# KOKORO_MODEL=onnx-community/Kokoro-82M-v1.0-ONNX
```

**Local data** (git-ignored, in `apps/web/.data/`):

| Folder | What it holds |
|---|---|
| `models/` | Kokoro model, about 90 MB, downloaded on first use |
| `voice/` | WAV cache, keyed by the sha1 of provider, voice and text |
| `mission-images/` | Mission scene pictures |
| `mission-voice/` | older Gemini-voice cache |

---

## 3. Stack

- **App:** Next.js 16 (App Router, Turbopack dev), React 19, TypeScript, Tailwind v4.
- **Libraries:** next-intl, zod/v4, PGlite, `motion/react`, lucide-react.
- **Monorepo:** npm workspaces with `apps/web`, `packages/*` (`@lms/ui`, `@lms/i18n`) and `fixtures` (`@lms/fixtures`).
- **AI:** Google Gemini over REST, with model **groups and fallback chains**. When a model is busy, over quota or hung, it cools down and the next model in the chain is used. The built-in content is the last fallback.
  - The older **course planner still uses GLM** (`server/planner/llm.ts`).
- **Voice:** **Kokoro** (`kokoro-js` 1.2.1 on onnxruntime-node), run locally in a worker process. Gemini TTS is an alternative.

### Gemini free-tier limits seen during testing
| What | Limit |
|---|---|
| Flash text | about 20 requests/day per model (429s come quickly) |
| TTS | about 10 requests/day per model |
| Image models | **0** (needs billing) |

**Open decision (deferred by the user):** a paid Gemini plan, Vertex AI, or another provider. Nothing has been chosen, and the user said "keep this as such" for now.

---

## 4. Features built (what and where)

All paths below are under `apps/web/src/` unless they say otherwise.

### 4.1 About you: live profiling
- **5 fixed slots:** `field`, `experience`, `subrole`, `usecase`, `goal` (`QUESTION_COUNT` = 5).
- **Question 1 is fixed.** Every later question is **generated live by Gemini** from all previous questions and answers.
  - Uses the "fast" group, thinking low, a 9s server deadline, and a cache per answer path.
  - The rule-based bank is only a fallback.
- **experience** and **goal** options must keep their fixed values (`FIXED_VALUES`), because these are tags the adaptation relies on. Every option saves a tag.
- **Files:**
  - `lib/profiling.ts`: `SLOTS`, `PREFIX`, `FIXED_VALUES`, `bankQuestion(slot, answers)`, `cleanGenerated(slot, raw)` and `profileFromAnswers`. The last sets domain, domainOther, subRole, role, useCase, goal, goalDetail and tags.
  - `server/profiling.ts`: `nextProfileQuestion`.
  - Route: `app/api/v1/profiling/route.ts` (POST `{courseId, slot, answers}`).
  - UI: `components/enroll/live-profile-step.tsx`, with `ProfileBuilding`: profile chips fill in while the next question loads.
- **Saved fields:** `lib/setup.ts` `SetupAnswers` and `server/validators.ts` `AnswersIn` include `subRole`, `useCase`, `goalDetail`, `agentName` and `tags`.

### 4.2 The Mission: prior-knowledge activity (replaces the old quick-check quiz)
- **Format:** a 2–3 minute cinematic story set in the learner's own work. It has **3 scenes × 2 moments**, which gives **one quick-check item per module**. The questions are embedded as story decisions, plus one "why" answer.
- **The data is efficient:** it records *which idea the learner holds* per module, not just right or wrong.
  - `scoreMission` returns levels, the ideas held, and the effect of the "why".
  - The "why" is judged by Flash-Lite (`judgeWhy`).
- **The answer key stays server-side.**
  - Options are faithful retellings of the idea.
  - `alignOptions` re-checks each label against its wording, because the model sometimes mislabels which option is correct.
- **Audiences:** `learner` / `professional` / `executive` (`audienceOf`). Each has its own tone (`TONE`) and voice.
- **Visuals:**
  - A 21:9 frame with letterbox and grain (`mission-stage.tsx`).
  - An **animated assistant screen** per scene, written by Gemini (`mission-screen.tsx`): typing, a tool spinner that turns into a tick, then results.
  - **Live photoreal scene pictures per learner** (`missionImage`). The prompts carry the role's workplace, the task props, the audience's age and dress, and a consistent look for the colleague.
    - The image quota is 0 on the user's key, so the designed backdrops (`backdropOf`) show instead.
    - "limit: 0" pauses images for 10 minutes.
- **Prefetch:** the story is prefetched when About you ends (`lib/mission-client.ts`: `prefetchMission`, `loadMission`). The intro shows a "setting the scene" checklist.
- **Narration:** play/pause, replay and a voice toggle. Each beat narrates its line and **records the next line ahead** (`&ahead=1`).
- **Files:**
  - `lib/mission.ts`: types `MissionScript`, `MissionScene`, `MissionScreen`, `MissionKey` and `MissionIdea`; functions `pickItems`, `alignOptions`, `scoreMission`, `missionSignals`, `missionProfile`, `learningFromMission`, `missionLines` and `backdropOf`; data `SCRIPTED_PROMPTS` and `SCRIPTED_SCENES` (the fallback story).
  - `server/mission.ts`: `createMission`, `finishMission`, `judgeWhy`, `missionImage`, `missionPictures`, `missionVoice(id, key, lane)` and `narrateAll`. Of these, `narrateAll` records only the first 2 lines, in the "later" lane.
  - Routes: `app/api/v1/mission/route.ts`, `finish/route.ts`, `image/route.ts`, `voice/route.ts` (`?ahead=1` puts the line in the "later" lane).
  - UI: `components/enroll/mission-step.tsx`, `mission-stage.tsx`, `mission-screen.tsx`.
- **The result feeds the planner:** `PrecheckResult.activity.ideas` goes into `server/planner/service.ts` and `llm.ts`.
- **The old Discovery chat and the old quiz** stay reachable as links: `server/discovery.ts`, `components/enroll/discovery-step.tsx` and `precheck-step.tsx`.

### 4.3 "Your agent, built along": orientation
- The learner's own agent is **named from their task** (`agentNameFor`, e.g. "Follow-up Scheduler") and can be renamed. The name is saved as `agentName` on the profile.
- **Setup gives:** Job, Starting skills and Roadmap.
- **Each module adds a part:** Purpose, Brain, Tools, Memory, First run, Launch.
- **Where it shows:**
  - a card beside the setup steps (`voiceHost`);
  - the hero of the course page (`components/learning/course-journey.tsx`);
  - a header chip in lessons;
  - a "new part" pop-up, shown once per part (stored in `knowlab.agent.shown.<course>`).
- **Files:**
  - `lib/agent-build.ts` (pure): `agentNameFor`, `agentBlueprint`, `partBuiltLine`, `MODULE_PARTS`, `SETUP` and `SetupPhase`.
  - `components/agent/`: `agent-blueprint.tsx`, `agent-chip.tsx`, `agent-moment.tsx`, `use-agent.ts` and `agent-voice.tsx`.
    - `use-agent.ts`: during setup the live answers are authoritative.
- **Removed:** `components/tour/*`, `lib/tours.ts`, `server/tour.ts`, `app/api/v1/tour` and the `tour` i18n namespace.

### 4.4 Voiced companion: the agent speaks
- The companion **introduces each step**, **reacts to each answer** while the next question loads, and **says what each module part is for**.
- **All companion lines are fixed sentences** (`lib/guide-lines.ts`): `phaseLine`, `BUILD_READY_LINE`, `answerReaction`, `stageLine`, `FIXED_LINES` (19 lines) and `QUIET_STAGES` (explainer, which has its own sound).
  - Each line is recorded once, cached on disk, then plays in about 0.05s.
  - **Don't put names or answers in companion lines:** a new sentence takes the local voice 5–10s to make, so the companion would speak late.
  - **AI-written questions are NOT read aloud** for the same reason.
- **Client:**
  - `components/agent/agent-voice.tsx`: `AgentVoiceProvider`, mounted in `app/(app)/learn/layout.tsx`.
    - `say(text, {once, queue, silent})`. "Once" keys are `knowlab.agent.said.<key>`; the mute key is `knowlab.agent.voice`.
    - A queue: **a line is never cut**. The next line starts after the current one has been said (or read, when unspoken).
    - Prewarms `FIXED_LINES` one at a time.
    - Host counting: while the agent card is on screen it shows the spoken line with sound bars, and the bottom subtitle bar is hidden. The bar also hides while the Mission story is speaking.
  - `lib/narrator.ts`: a narrator singleton with owners `story` / `companion`. It provides `narrate(url, text, who)`, `narrateText(text, who, maxWait=6000)` (a late line shows silently), `prepareLine`, stop/pause/resume, `useNarration` and `useNarrationOwner`.
  - `lib/speech.ts`: browser speech helpers. Chrome needs a 120ms delay after cancel, and lines are split into sentences, with a retry.
- **Wiring:**
  - `enroll-flow.tsx` says `phaseLine(phase)` once per course phase.
  - `build-step.tsx` says `BUILD_READY_LINE`.
  - `player/player.tsx` says `stageLine(stage)`.
  - `hook-cinema.tsx` stops narration when the film begins.
- **Server:**
  - `server/voice.ts`: `voiceProvider()`, `voiceReady()`, `VOICES` and `speak(text, role, lane)`. It has a disk cache, a pending map, and promotion of waiting lines.
  - `app/api/v1/voice/route.ts`: POST `{text ≤400, ahead?}`. It needs a session and returns `audio/wav` (404 if there's no voice).
  - `server/ai/kokoro.ts` forks `apps/web/scripts/kokoro-worker.mjs` (a plain Node IPC worker: `{id,text,voice}` in, `{id,wav base64}` out).
    - Inside Next.js the model ran about 4x slower, which is why it has its own process.
    - **Two lanes:** "now" (a learner is waiting) always goes before "later" (recording ahead). `MAX_LATER` = 4, beyond which `SkippedAhead` is raised; it is not an error. `kokoroPromote` moves a waiting line up.
    - The queue lives in globals named `__kokoro*V2`.
- **Kokoro voices:**

| Voice | Used for |
|---|---|
| `af_heart` | companion |
| `af_bella` | learner |
| `am_michael` | professional |
| `bf_emma` | executive |

- **Gemini TTS alternative** (`server/ai/gemini-tts.ts`):
  - Chain: 3.8-flash-tts → 3.8-flash-lite-tts → 3.1-flash-tts-preview → 2.5-flash-preview-tts.
  - Voices per audience: Puck, Charon, Kore.
  - Recordings are **transcribed and compared** (`lib/transcript.ts`, `matchesTranscript`), because the TTS sometimes *answers* a line instead of reading it.
  - **Never send style or delivery notes to the TTS.** It reads them aloud.

### 4.5 Other files touched
- **`server/ai/gemini.ts`:** text chains. **`gemini-image.ts`:** `geminiImage`, `geminiImagesReady`.
- **`next.config.ts`:** `serverExternalPackages` includes kokoro-js, @huggingface/transformers, onnxruntime-node, phonemizer and sharp.
- **`en.json` namespaces:** `enroll` (lp*, ms*, msPrep*, msWaiting, msReplay, msPause, msResume) and `agent`.
- **Earlier in the same session:** page text was shortened across marketing, course and learning pages. The git baseline before that work is commit `6fe919b`.

---

## 5. Gotchas

- **Dev-server stale modules:** a *new* route can get a stale copy of an *edited* server module, which shows up as errors like `x is not a function`. The fix used was to put new code in **new files** (that's why `gemini-image.ts`, `gemini-tts.ts` and `server/voice.ts` exist).
  - Old module instances also stay alive after edits, and their queues keep running. A **dev-server restart** clears them.
- **Browsers block sound** on a freshly loaded page until the user clicks.
- **A hidden preview pane** pauses animations and rAF. This is not a bug.
- **Speed on this machine:** Kokoro makes a fresh sentence in about 5–8s, and cached lines play instantly.
- **Lint rules hit:** react-hooks `set-state-in-effect`, purity, static-components (hence `PartIcon`) and preserve-manual-memoization.
  - The `world.ts` lint warnings existed before this work.

---

## 6. State and next steps

- **Nothing is committed** since `6fe919b`. The many changes are in the working tree; new files are listed by `git status`.
- **Last fix (verified in the browser):**
  - Mission narration plays: open, scene and moment lines, with the next line recorded ahead.
  - Profile reactions show in the agent card instantly, with no bottom bar.
  - Typecheck is clean and 40 tests pass.
- **Suggested:** restart the dev server once to clear old module instances and an orphan Kokoro worker.
- **Open:**
  - The AI provider choice (paid Gemini, Vertex or other) is deferred.
  - `docs/architecture.md` hasn't been updated for the features above.
  - The root `agents.md` is outdated (it describes the Vite app).
- **Working rules used so far:**
  - Don't commit unless asked.
  - Don't kill the user's dev server.
  - Don't press final Continue, Save or Build in enrolment while testing (it changes saved data).
  - Restore any localStorage test data you change.
