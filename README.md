# LMS Platform — web UI

UI build for the LMS described in `ARCHITECTURE.pdf`. The plan is in [`ui-plan.md`](./ui-plan.md).
Course content is mock data in `fixtures/`. Learner data (profile, enrolments, plans, progress) is stored by the backend in `apps/web/src/server`, which has an AI model (GLM, from Z.ai) plan each learner's course. Sign-in is a demo user for now. The demo course is **Build Your First AI Agent** (`/learn/courses/ai-agent`).

## The demo course

**Build Your First AI Agent**: six modules, each running the same phases (problem hook, concept videos, worked example, guided practice, scenarios, spaced review), then one mini project, a final assessment and a reflection. Enrolling asks the profile questions, plays a course preview video, then asks 12 prior-knowledge questions that set support module by module.

The course is written as compact JSON in `fixtures/src/ai-agent/` (see `AUTHORING.md` there) and built into the fixture files the app reads:

```bash
node fixtures/scripts/build-ai-agent.mjs --check   # validate the sources
node fixtures/scripts/build-ai-agent.mjs           # write fixtures/*.json
python fixtures/scripts/make-audio.py              # narration MP3s for new or changed slides (pip install edge-tts)
node fixtures/scripts/check-project.mjs            # mini project: the starter must fail, the reference solution must pass (needs Python 3.10+)
```

## Run it

Requires Node.js 20+ (installed: 24 LTS).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
npm run typecheck
```

## Backend: AI plans each learner's course

When someone enrols, their profile answers, customise choices and quick-check answers go to the server. It stores a rule-based **standard setup** at once, then asks **GLM** (Z.ai; `glm-4.7-flash` by default) to write the learner's plan:

- topic order;
- emphasis per module;
- help per lesson, each with a reason;
- pacing;
- an opening scenario retold for their role and field;
- an "In your world" example for every lesson;
- a brief for the mini project.

The quick check scores each module (two questions per module); a module's score sets the starting help for all of its lessons.

As they learn, answers come back as signals (in-video checks, scenario decisions, recall questions, each module's check, the final assessment, finished modules), and the plan is revised. A revision happens after a finished module, after two misses in one lesson, or after a failed module check or final assessment; the lessons a failed check found weak get more help (a final-assessment miss names a whole module). AI revisions are at most one per 10 minutes per learner; in between, and without an API key, a rule raises help on missed lessons. Every version is kept with its reasons, and the course page shows the history.

- **Turn on AI planning:** copy `apps/web/.env.example` to `apps/web/.env.local` and set `GLM_API_KEY` (from z.ai), then restart `npm run dev`. Without a key everything works on the standard setup. `GET /api/v1/health` says whether AI planning is configured and which model is used. The learner only ever sees "Personalised for you"; the provider is never named in the app.
- **Models and cost:** the default `glm-4.7-flash` and its fallback `glm-4.5-flash` are free on Z.ai. A plan takes about 30–90 seconds on them, and the free tier is often busy (HTTP 429): the planner waits, then tries the fallback, and the learner keeps the standard setup if both are busy. For better plans, set `GLM_MODEL=glm-5.3` (paid; needs balance on the Z.ai account). `GLM_THINKING=enabled` turns on the model's reasoning, which is several times slower. China platform keys need `GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4`.
- **Database:** PGlite, a full Postgres that runs inside Node, stored in `apps/web/.data/pglite` (gitignored), so nothing needs installing. Set `DATABASE_URL` to use a Postgres server (Cloud SQL in production). Migrations run on first use; after changing `src/server/db/schema.ts`, run `npx drizzle-kit generate` in `apps/web`.
- **Safety:** the model's reply is checked twice before anyone sees it. First against a schema (`src/lib/learner-plan.ts`; one correction round is allowed), then against the real course (`src/server/planner/validate.ts`): real ids, the opening scenario first, the module check then the recall topic last, capped text, no links. Anything invalid falls back to the standard setup. The plan is also held to what the learner said: a help level they set applies everywhere, "see a full example first" keeps the example first, and until there are answers from inside the course the model may add help but not remove the extra help a weak quick check calls for. Refusals and API errors keep the standard setup; the learner sees a short neutral reason and the details go to the server log (`[planner]`).
- **API** (`src/app/api/v1`): `/profile`; `/enrollments` and `/enrollments/[courseId]`, which include the current plan, any plan in progress and progress; `/enrollments/[courseId]/plans` (history); `/signals`; `/progress`; `/enrollments/[courseId]/project` (the mini project's saved files and last report), `/project/tests` (the hidden tickets, without their expected answers) and `/project/check` (grades a run on the server); `/me/import` (a one-time import of older browser data); `/me/data` (reset); `/health`.
- **Tests:** `node tests/backend/run.mjs` in `apps/web` runs the planner, validator, policy and service against an in-memory database, with a stand-in for the GLM API (no API calls).
- **Still in the browser:** the study plan, display preferences, video settings, videos watched, guide steps and finale state. Module checks and the final assessment are also graded in the browser for now (`src/data/mock-grader.ts`); their results are sent to the server as signals.

## What is where

| Path | Contents |
|---|---|
| `apps/web` | Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Radix) |
| `packages/ui/tokens.css` | Design tokens: Frosted Aura (light app) and Aurora (dark marketing/auth), glass, charts, nine stage colours, motion |
| `packages/i18n/en.json` | Every UI string (next-intl). Keys are type-checked against this file |
| `fixtures/` | Mock data shaped like the content schema and data model: the course catalog, each module's phases, concept videos, the course preview, the prior-knowledge check, the finale, a learner and the mock answer keys. All `*-ai-agent.json` files, `courses.json` and `mock-gate-keys.json` are generated from `fixtures/src/ai-agent/`; edit the sources, not the output. Content files are registered in `apps/web/src/data/index.ts` |
| `fixtures/src/ai-agent/` | The course source and its authoring guide (`AUTHORING.md`) |
| `fixtures/scripts/` | `build-ai-agent.mjs` (validate and build the course), `make-audio.py` (narration audio), `check-project.mjs` (the mini project's difficulty) |
| `apps/web/public/audio/` | Narration, one MP3 per slide: `video-{id}-s{n}.mp3` |

## Routes

| Route | Screen |
|---|---|
| `/` | Marketing home (Aurora): hero, method bento, design rules, teams, pricing, FAQ, footer |
| `/auth/sign-in` | Sign in UI (email link + SSO; both lead into the demo) |
| `/learn` | Learner home. With an empty catalog: a "No courses yet" state. Before enrolment: course spotlight and how setup works. After: what's up next, the resume card, live KPIs and the course card. The sidebar has Dashboard, Courses, Plan, Profile and Settings |
| `/learn/courses` | Catalog: one Coursera-style card per course with a draggable module carousel and "View details"; an empty state while there are no courses |
| `/learn/courses/[courseId]` | Course details: hero, a "Set up for you" panel once enrolled ("Your course is ready" after enrolling), stats strip, sticky section nav with scroll-spy, each module's topic flow, and one outline list: the modules then the mini project, final assessment and reflection, each row opening "What you'll learn". `#module-m2` and `#finale` open those rows |
| `/learn/courses/[courseId]/enroll` | Enrolling, in five steps: **About you** (seven profile questions, asked once and reused by later courses), **Preview** (a narrated course preview video, when the course has one; skippable), **Quick check** (12 ungraded questions that set help per module or lesson; can be skipped), **Customise** (adjust lesson order, field examples, role framing, help per lesson, explanations, comfort and pace, with live samples), **Build** (the course assembles, then "your course is ready"). On an enrolled course it opens on Customise; `?step=precheck` retakes the quick check |
| `/learn/profile` | The seven profile answers, editable, plus each course's quick check and setup |
| `/learn/plan` | Learning plan for enrolled courses: add a session on a chosen day, study days and session length, "Plan it for me" with undo, course outline, study calendar |
| `/learn/courses/[courseId]/[moduleId]/[stage]` | Module player. The module is laid out in numbered parts under side headings: The problem (the hook), Learn the ideas (one part per lesson video, `explainer?v=m1-2`), See it work, Build it, Apply it, Check yourself (a 6-question module check, 80% to pass) and Make it stick (spaced review). Each part says what you do in it and how long it takes; the same layout shows on the course page. The demo locks nothing (`lib/demo.ts`): every part opens and "Complete and continue" always works. Topics follow the setup answers. The problem hook (`hook`) is full screen with no rail, tutor or banners: an illustrated, narrated film the learner plays through at their own pace (sending the chatbot a message, opening the inbox, spotting the mistake, holding a button while the weekend passes), one spoken line on screen at a time and nothing gone until they continue; then your call with how sure you are, the replay step by step in time with the voice, and the verdict. A concept topic can be a set of narrated slide videos. Guided practice is a numbered, step-by-step build with values to copy and a check for each step. Scenarios (`lab`) give three new situations, each with evidence, a decision and a debrief. A module with no lessons yet shows a notice. Finishing a module opens the next one |
| `/learn/courses/[courseId]/finale/[step]` | Course finale after all modules: `capstone` (the brief, with the last test result and a link to the workspace), `final-check` (80% pass mark), `wrap-up` (reflection, what you built, credential) |
| `/learn/courses/[courseId]/finale/capstone/workspace` | The mini project workspace: a Monaco editor for `prompt_engine.py`, Orbit's policy beside it, **Run** (four sample emails, every step shown: the messages sent, the model's raw reply, what was parsed, the decision, against what Scout should do) and **Run tests** (ten hidden emails, twice, graded on the server; 80% passes and the email that tries to change Scout's rules must be handed off). Python runs in the browser (Pyodide in a worker inside a sandboxed iframe); the files autosave to the server |
| `/learn/settings` | Settings: each course's setup answers, larger text and reduced motion (applied live), and a reset for the demo data |
| `/kit` | Component showcase with a light/dark theme toggle |

## Notes

- **Brand mark.** The interlaced-rings logo lives in `apps/web/public/brand/` (transparent PNG, made from the original artwork) and in `src/app/icon.png` / `apple-icon.png` for the browser tab. On screen it sits on a small white disc so its deep colours read on the dark theme.
- **Dark by default.** Both root layouts render the dark Aurora theme. Learners can switch the app to the light theme in Settings; an inline script applies it before paint. Moving between the two root layouts is a full page load (Next.js behaviour).
- **Tickers.** `NumberTicker` rolls digits into place when a number scrolls into view or changes. `TickerTape` is a scrolling strip with a pause button that pauses on hover and focus. Both show a static final state under reduced motion, from the OS or the learner's setting.
- **Motion.** Slow aurora drift (paused inside lessons), cursor spotlight on cards, page transitions, staggered entrances, animated progress, and a sliding nav pill. All of it switches off with reduced motion.
- **Gate answers are not in the UI data.** `src/data/mock-grader.ts` stands in for the server-side scoring endpoint and must be deleted when the API exists.
- **next-intl plugin is not used.** It loads `@swc/core`'s native binary, whose install script npm blocks by default. `next.config.ts` sets the one alias the plugin would add.
- **Learner data.** Profile, enrolments, plans and topics done are on the server. The study plan, drafts and display settings stay in `localStorage` (`lms-*` keys). Settings › Reset clears both.
- **Topics, not method names.** Every module shows its own topic titles in the method's order. The capstone, final check and wrap-up happen once, after all modules; modules are never locked. Method names live only in code (`src/lib/stages.ts`) and on `/kit`.
- **Adaptation.** Setup answers change the lessons, and a "Tuned for you" strip in the player says why. Field adds an "In your world" card. Role reframes the opening. "What helps first" reorders idea, example and try. Analogy preference opens the alternative explanation. Experience sets the support level.
- **Guided practice.** No multiple choice: numbered steps the learner does in the course's own tools. Each step has the actions, values to copy, a "You should see" check and a "Stuck?" tip (open by default for extra support). Steps done are saved per module.
- **Mini project.** "Build Scout's prompt engine": the learner writes `prompt_engine.py` in the browser, calling a practice model through the same `client.messages.create(...)` code the course teaches. The practice model (`fixtures/src/ai-agent/project/orbit/model.py`) is deterministic and literal: it only does what the prompt clearly asks, so every gap shows up as a realistic mistake (prose instead of JSON, made-up policy, obeying an injected instruction). Hidden tickets are graded on the server and never sent with their answers; the result goes to the learner's plan, so weak areas get more help, and a pass marks the project done. See `fixtures/src/ai-agent/AUTHORING.md`, section 6.
- **Concept videos.** HTML/CSS slides synced to recorded narration (`public/audio/video-*.mp3`). Items on a slide appear as the narration reaches them. Each video pauses for two quick checks halfway and two at the end; a wrong answer gets a hint, not the answer. Controls: play/pause, slide track, speed, captions, chapters, transcript, mute, full screen; keyboard Space, arrows, M, C, F.
- **No invented numbers.** Ratings, reviews and career outcomes show empty states. Hours of manual work, for courses that set them, are labelled as course design estimates.
