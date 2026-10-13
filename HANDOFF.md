# Handoff: Nebula KnowLab LMS demo, "Build Your First AI Agent"

Give this file to Claude on the new machine as the starting context. It covers what the project is, where the code lives, how to run it, everything that was built in the previous session, how the pieces fit, and what is still open.

---

## 1. Where the code is

| | |
|---|---|
| GitHub repo | https://github.com/kavish-nebula/lms-demo |
| Our branch | **`feature/ai-agent-course`** (one commit, `2273f9a`, authored as `geetikanebula`) |
| It starts from | `d76766d` on `feature/lms-web-nextjs` ("Add LMS learner web app (Next.js) with the n8n course") |
| Not merged yet | `782d3ad` on `feature/lms-web-nextjs`, pushed the same day by mithun-nebula: "Add learner backend with GLM course planning; trim learner pages". See section 9. |
| Old machine path | `C:\Users\System3\Downloads\lms-platform-feature-lms-web-nextjs\lms-platform-feature-lms-web-nextjs` |

Not in git (old machine only): `.claude/launch.json` was changed to a local path, and the backup of the removed n8n course is at `C:\Users\System3\Downloads\lms-platform-backup-before-n8n-removal`.

## 2. Set up on a new machine (Windows)

```bash
winget install --id Git.Git -e
git clone -b feature/ai-agent-course https://github.com/kavish-nebula/lms-demo.git
cd lms-demo
npm install
npm run dev
```

Open http://localhost:3000. Node 24 and Python 3.12 were used. Pushing asks you to sign in to GitHub in the browser (the previous push used the `geetikanebula` account).

Useful commands (from the repo root):

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 (Next.js 16, Turbopack). Run it in a terminal tab you keep open. |
| `npm run typecheck` | `next typegen && tsc --noEmit`. The main correctness check; it also type-checks every i18n key. |
| `npm run build` | Production build. |
| `node fixtures/scripts/build-ai-agent.mjs --check` | Validate the course sources, write nothing (`--check m3` for one module). |
| `node fixtures/scripts/build-ai-agent.mjs` | Validate and write the generated course JSON in `fixtures/`. |
| `python fixtures/scripts/make-audio.py` | Create missing or changed narration MP3s (`--only m3`, `--only intro`, `--force`, `--dry-run`). Needs `pip install edge-tts` and internet. |

`npm run lint` fails with an ESLint config import error that was there before this work; it was not fixed.

If pages look stale or show hydration errors, stop the server, delete `apps/web/.next`, and start it again.

## 3. The stack

- Monorepo with npm workspaces: `apps/web` (the Next.js app), `packages/*` (UI tokens, `packages/i18n/en.json` messages), `fixtures` (course data).
- Next.js 16.4 App Router with Turbopack, React 19, TypeScript, Tailwind v4, `next-intl`, `motion/react`, `lucide-react`.
- No backend in this branch: progress, enrolment and answers live in the browser's localStorage. Assessment answer keys are mocked in `fixtures/mock-gate-keys.json` and graded in `apps/web/src/data/mock-grader.ts`.
- `apps/web/AGENTS.md` warns that this Next.js version differs from older ones; read `node_modules/next/dist/docs/` before changing framework-level code.
- The root `AGENTS.md` / `agents.md` describes an older Vite version of the app (an `lms-feature/` folder that no longer exists). Treat it as background only; this file and `README.md` are current.

## 4. The course

**Build Your First AI Agent.** The learner builds Scout, a support agent for Orbit Outdoor (a small online shop for hiking and camping gear). Recurring people: Maya (founder), Leo (support lead), Priya (developer). Six modules:

1. Introduction to AI Agents
2. LLM Foundations for Agents
3. Giving Your Agent Tools
4. Memory, Planning and Reasoning
5. Build Your First Agent (Hands-on Project)
6. Deployment and Next Steps

Every module has 11 parts in 7 headed sections, following the 9 Bloom phases the user asked for:

| Section | Part(s) | Source |
|---|---|---|
| 1 The problem | Problem hook (interactive film, then the learner's call, replay, verdict) | `mN/blocks.json` → `hook` |
| 2 Learn the ideas | 5 narrated slide videos, one per lesson, 6 to 8 min each, with 2 mid and 2 end quiz questions | `mN/video-N.k.json` |
| 3 See it work | Worked example: predict, then watch runs | `blocks.json` → `worked` |
| 4 Build it | Guided practice, 6 to 8 steps | `blocks.json` → `guided` |
| 5 Apply it | 3 scenarios | `blocks.json` → `lab` |
| 6 Check yourself | Module check: 6 questions, 80% to pass | `mN/assessment.json` |
| 7 Make it stick | Spaced review after 3, 10 and 30 days | `blocks.json` → `review` |

After the modules, the finale has: mini project (capstone), final assessment (12 questions), reflection.

Enrolment: About you (7 profile questions) → Preview (about a 1-minute narrated video) → Quick check (12 prior-knowledge questions that set support per module) → Customise → Build.

### Course data pipeline

- **Edit sources only:** `fixtures/src/ai-agent/` (`course.json`, `intro.json`, `precheck.json`, `finale.json`, `m1..m6/` with `video-*.json`, `blocks.json`, `assessment.json`, plus `audio-manifest.json`).
- `fixtures/src/ai-agent/AUTHORING.md` is the full authoring spec: story world, house style, every JSON shape, the hook film scene types, the assessment format.
- `fixtures/scripts/build-ai-agent.mjs` validates the sources and writes the generated files in `fixtures/` (`courses.json`, `module-ai-agent-mN.json`, `videos-ai-agent.json`, `intro-ai-agent.json`, `precheck-ai-agent.json`, `finale-ai-agent.json`, `mock-gate-keys.json`). Never edit the generated files by hand.
- The build inserts each module's check into `courses.json` (as the `gate` stage and topic, just before `review`); `course.json` itself does not list it.
- The app imports the generated files in `apps/web/src/data/index.ts`, which also attaches each module's videos to its concept block.

### Narration audio

- Voice `en-US-AndrewMultilingualNeural` via edge-tts. All clips are in `apps/web/public/audio/` and committed.
- Clip names: `video-{mN-k}-s{n}.mp3` (lesson slides), `video-ai-agent-intro-s{n}.mp3` (preview), `hook-mN-s{i}.mp3` and `hook-mN-s{i}-then.mp3` (hook film lines), `hook-mN-r{k}.mp3` (hook replay steps), `hook-mN-open.mp3` (only used by hooks without a film).
- `audio-manifest.json` stores a hash of each clip's text, so only new or changed narration is regenerated. The script reads replay captions with ids spelled out digit by digit and code names as words.

## 5. What was done, in order

1. **Demo course ideas.** Suggested attention-grabbing demo topics; the user chose "Build Your First AI Agent".
2. **Removed the n8n course** and everything tied to it (sandbox, fixtures, assets). Backup kept on the old machine (section 1).
3. **Built the AI agent course:** 6 modules, 30 videos, 245 slides, worked examples, guided builds, scenarios, reviews, finale, enrolment preview and quick check, narration for everything, the source-and-build pipeline, and the authoring guide.
4. **Problem hook, version 1:** a full-screen "cinema" (cold open, team chat, cost, call, replay, verdict).
5. **Hook, version 2:** illustrated animated scenes (website chat, helpdesk, phone, email, policy vs reply, parcel map, logs, long chat, test grid, time-lapse, numbers) with subtitles and sound effects.
6. **Hook, version 3 (current), after "the text is too long and disappears":** a learner-paced, interactive film. Each scene shows one short spoken line, lit word by word, that stays until the learner presses Continue. Most scenes ask the learner to act: send the chatbot a message (module 1), spot the wrong phrase in Scout's reply (2), track the parcel (3), hold to keep the chat going (4), run the tests (5), hold to fast-forward the weekend (6). The replay speaks each step's caption exactly as shown and waits for the voice; the learner can step back.
7. **Audio reliability:** narration is unlocked inside the Begin click (Safari and Firefox block audio started later), a level meter shows when the narrator is speaking, and a "Tap to hear the narration" button appears if a browser still blocks it.
8. **Dev server:** the app had stopped because the desktop app's preview server was shut down. It now runs with `npm run dev` in a terminal tab.
9. **Course preview video, rewritten twice.** It is now about 1 minute, 6 slides, generic and trust-building: picture the end of the course, your agent at work, "no magic, just steps", six things you'll be able to do, what it takes, what you'll walk away with. It no longer tours the modules. Open it at `/learn/courses/ai-agent/enroll?step=intro`.
10. **Module restructure:**
    - Modules are now laid out under side headings, with each lesson video as its own part.
    - The same layout shows in the player's sidebar and on the course page.
    - A 6-question module check was added to every module, with questions written for this course.
    - Nothing is locked in the demo.
11. **Pushed** to the new branch `feature/ai-agent-course` (Git for Windows was installed with winget for this).
12. **Guided practice became a gamified mission** (after the push, so not on GitHub yet unless pushed again):
    - Every module's "Build it" part opens with the team's briefing on a real Orbit problem and a gear checklist.
    - The mentor (Priya) hands over each step as a chat message. The learner ticks the moves off, then confirms the checkpoint ("Yes, I see it" or "Not quite", which brings Priya's tip).
    - A step that works earns 100 XP (150 without help), keeps a streak going, and gets a teammate's reaction.
    - The steps are waypoints on a trail to a summit that awards a badge, 1 to 3 stars and the team's debrief.
    - The code is in `apps/web/src/components/player/stages/guided-stage.tsx`. The content is `guided.mission` and `steps[].win` in each `mN/blocks.json`. Progress is kept in localStorage under `lms-mission:{step_id}`.

## 6. Key code and how it fits

### Problem hook (`apps/web/src/components/player/hook/`)

| File | Role |
|---|---|
| `hook-cinema.tsx` | The full-screen hook: start → film → call (pick a hunch + "how sure are you?") → replay → verdict. Hooks without a film fall back to text scenes. |
| `film.tsx` | `FilmPlayer` / `FilmScene`: per-scene clock that stops at gates and only runs while a hold button is held; the action and hold buttons; Continue; `Spoken` (word-by-word caption); `VoiceBadge` (level meter or "Tap to hear"). |
| `shots.tsx` | The 11 scene renderers, each a pure function of its clock `t`; `trackOf()` gives each type's timeline (`len`, `gates`, `hold`, `inScene`); `actLabel()`. |
| `voice.ts` | `useVoice`: one narration clip at a time, `say(src)` returns a promise, `unlock()` (call from a click), `blocked` and `retry()`. |
| `replay.tsx` | Step-by-step replay on the pipeline diagram, in time with each step's clip. |
| `sfx.ts` | Small Web Audio sound effects. |
| `film.css`, `hook-cinema.css` | Styles; the film frame sizes everything in container units (`cqw`). |

Hook film data is `hook.film.shots`: each shot has `type`, `label`, `say`, and for interactive types `act` and/or `then`. The full table is in `AUTHORING.md`.

### Module layout and player

| File | Role |
|---|---|
| `apps/web/src/lib/module-outline.ts` | Pure: `moduleOutline(module, topics, order)` → sections (`problem`, `learn`, `see`, `build`, `apply`, `check`, `keep`) → numbered parts, each with a title, minutes, what the learner does (`deliverable`) and its path. Also `videoMinutes`, `flatParts`, `currentPart`. |
| `apps/web/src/components/player/module-map.tsx` | Renders the outline: the `rail` variant (player sidebar, auto-scrolls to the current part) and the `page` variant (course page). Every part is a link. |
| `apps/web/src/components/player/player.tsx` | The module player. Navigation is by part; `?v=mN-k` picks the lesson video on the `explainer` stage; "Complete and continue" goes to the next part; renders the module check through `GateStage` with `scope="module"` and `checkId="gate-mN"`. |
| `apps/web/src/components/player/video/video-explainer.tsx` | One lesson video per page (no tab grid), with "In your world" and key ideas. |
| `apps/web/src/components/player/video/watched.ts` | `useWatchedVideos` (localStorage key `lms-videos-watched`). |
| `apps/web/src/components/player/stages/gate-stage.tsx` | Summative check for both the module check and the final assessment (`scope`). |
| `apps/web/src/lib/stages.ts` | `MODULE_STAGES` now includes `gate`. |
| `apps/web/src/app/(app)/learn/(player)/courses/[courseId]/[moduleId]/[stage]/page.tsx` | Player route; reads `?v=`. |
| `apps/web/src/app/(app)/learn/(shell)/courses/[courseId]/page.tsx` | Course page; builds each module's outline on the server and passes it to `ModulesSection` / `ModulePanel` in `components/course/course-sections.tsx`. |

### Module check grading

The build turns `mN/assessment.json` into the module's `gate` block and keys `gate-mN` / `gate-mN_explain` in `fixtures/mock-gate-keys.json`. The right answer is rotated through a, b, c and d for an even spread. Passing needs 80% overall (`min_correct_per_objective: 0`). Lessons with no right answer still get "Rewatch N.k …" links back to their videos.

### Demo mode: nothing locked

`apps/web/src/lib/demo.ts` exports `DEMO_OPEN = true`. Set it to `false` to restore the completion rules. It is used in:

- `stage-shell.tsx`: "Complete and continue" is never disabled.
- `worked-stage.tsx`: "Run it" works without a prediction.
- `gate-stage.tsx`: "Continue anyway" after a failed check.
- `hook-cinema.tsx`: "Skip to …" always shows.
- `course-sections.tsx`: every module has "Preview this module".
- `finale/wrap-up-stage.tsx`: "Finish course" works without a passed final check.

### Routes

| Route | What it is |
|---|---|
| `/learn/courses/ai-agent` | Course page; open a module, then "11 parts in this module". |
| `/learn/courses/ai-agent/enroll` | Enrolment; `?step=intro` opens the preview, `?step=precheck` the quick check. |
| `/learn/courses/ai-agent/mN/hook` | Problem hook. |
| `/learn/courses/ai-agent/mN/explainer?v=mN-k` | Lesson video k. |
| `/learn/courses/ai-agent/mN/worked`, `/guided`, `/lab`, `/gate`, `/review` | The other parts. |
| `/learn/courses/ai-agent/finale/capstone`, `/final-check`, `/wrap-up` | Finale. |

## 7. How changes were verified

- `npm run typecheck`, and the build script's `--check`, after every change.
- Headless Chrome driven over the DevTools protocol from small Node scripts. They clicked through hooks (send, tap, hold, spot), played videos, took module checks (pass and fail) and saved screenshots and page errors. Those scripts lived in the session's temporary folder and are not in the repo; rebuild them if needed.
- Why not the desktop app's browser pane: when the pane is hidden, animations pause and screenshots go stale, so it gives false results.

## 8. Working notes for Claude

- Windows, PowerShell 5.1: no `&&`. New terminals see `git` on the PATH; older ones may need `"C:\Program Files\Git\cmd\git.exe"`.
- Run the dev server in a terminal tab (`npm run dev`). The desktop app stops preview servers between turns, which made the site look broken once.
- i18n keys are type-checked: add strings to `packages/i18n/en.json` before using them. Plurals use ICU syntax.
- Edit course content in `fixtures/src/ai-agent/`, run the build, and regenerate audio for any changed narration.
- Answer keys live client-side in mock files on purpose for the demo; a backend plan exists in `backend-plan.md`.

## 9. Open items

1. **Merge with `782d3ad`.** The backend commit on `feature/lms-web-nextjs` and our branch both change 15 files, so merging needs conflict resolution, ideally together with mithun-nebula:
   - Changed on both sides: `README.md`, `enroll-flow.tsx`, `precheck-step.tsx`, `capstone-stage.tsx`, `finale-player.tsx`, `wrap-up-stage.tsx`, `home-dashboard.tsx`, `player.tsx`, `guided-stage.tsx`, `video-explainer.tsx`, `lib/setup.ts`, `fixtures/learner.json`, `packages/i18n/en.json`.
   - We deleted, they edited: `hook-stage.tsx` and `sandbox/workspace.tsx`.

   A pull request can be opened at https://github.com/kavish-nebula/lms-demo/pull/new/feature/ai-agent-course
2. **Review the module check questions.** The 36 questions in `fixtures/src/ai-agent/m1..m6/assessment.json` were written by AI agents and validated by the build, but not yet read by a person.
3. **Lint** is broken by a pre-existing ESLint config import error.
4. **Leftovers that could be tidied:**
   - Unused strings in the `video` namespace (for example `watchAll`, `lessons`, `slidesN`).
   - The beats fallback in `explainer-stage.tsx` is no longer reached.
   - The text-only hook path in `hook-cinema.tsx` is only used by hooks without a film.
   - `TopicRail` in `components/kit/stage.tsx` is now only used by the finale.
5. **Before a real launch:** set `DEMO_OPEN` to `false`, and move answer keys server-side.

## 10. What the user cares about

- This is a **demo** of the LMS platform; things should look polished and work with any click.
- Learning content should be **engaging, short and neat**. Avoid long blocks of text and text that disappears before it is read. Prefer interaction ("make it happen yourself"), visuals and voice.
- The course preview should **build trust**: show what the learner will be able to do by the end, not the course mechanics.
- Modules should have a **clear structure**: headings, one video per part, and a visible deliverable for each part.
- The user writes quickly and informally; read for intent. Give clickable links to open results locally (`http://localhost:3000/...`).
- GitHub pushes go to new branches, as `geetikanebula`; existing branches are not overwritten.
# Historical source-branch handoff

This imported handoff describes earlier source-branch work. For the merged backend architecture and current boundaries, read [adaptive-backend-merge.md](docs/adaptive-backend-merge.md) and the current README. Its statements about missing backend/project features are historical.
