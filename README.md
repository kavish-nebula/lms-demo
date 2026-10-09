# LMS Platform — web UI

UI build for the LMS described in `ARCHITECTURE.pdf`. The plan is in [`ui-plan.md`](./ui-plan.md).
This phase is UI only: screens read mock data from `fixtures/`; there is no backend or auth yet. The demo course is **Build Your First AI Agent** (`/learn/courses/ai-agent`).

## The demo course

**Build Your First AI Agent**: six modules, each running the same phases (problem hook, concept videos, worked example, guided practice, scenarios, spaced review), then one mini project, a final assessment and a reflection. Enrolling asks the profile questions, plays a course preview video, then asks 12 prior-knowledge questions that set support module by module.

The course is written as compact JSON in `fixtures/src/ai-agent/` (see `AUTHORING.md` there) and built into the fixture files the app reads:

```bash
node fixtures/scripts/build-ai-agent.mjs --check   # validate the sources
node fixtures/scripts/build-ai-agent.mjs           # write fixtures/*.json
python fixtures/scripts/make-audio.py              # narration MP3s for new or changed slides (pip install edge-tts)
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

## What is where

| Path | Contents |
|---|---|
| `apps/web` | Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Radix) |
| `packages/ui/tokens.css` | Design tokens: Frosted Aura (light app) and Aurora (dark marketing/auth), glass, charts, nine stage colours, motion |
| `packages/i18n/en.json` | Every UI string (next-intl). Keys are type-checked against this file |
| `fixtures/` | Mock data shaped like the content schema and data model: the course catalog, each module's phases, concept videos, the course preview, the prior-knowledge check, the finale, a learner and the mock answer keys. All `*-ai-agent.json` files, `courses.json` and `mock-gate-keys.json` are generated from `fixtures/src/ai-agent/`; edit the sources, not the output. Content files are registered in `apps/web/src/data/index.ts` |
| `fixtures/src/ai-agent/` | The course source and its authoring guide (`AUTHORING.md`) |
| `fixtures/scripts/` | `build-ai-agent.mjs` (validate and build the course), `make-audio.py` (narration audio) |
| `apps/web/public/audio/` | Narration, one MP3 per slide: `video-{id}-s{n}.mp3` |

## Routes

| Route | Screen |
|---|---|
| `/` | Marketing home (Aurora): hero, method bento, design rules, teams, pricing, FAQ, footer |
| `/auth/sign-in` | Sign in UI (email link + SSO; both lead into the demo) |
| `/learn` | Learner home. With an empty catalog: a "No courses yet" state. Before enrolment: course spotlight and how setup works. After: resume card, live KPIs, the setup the course is tuned to, course card, this week, reviews, assignments |
| `/learn/courses` | Catalog: one Coursera-style card per course with a draggable module carousel and "View details"; an empty state while there are no courses |
| `/learn/courses/[courseId]` | Course details: hero, a "Set up for you" panel once enrolled ("Your course is ready" after enrolling), stats strip, sticky section nav with scroll-spy, each module's topic flow, and one outline list: the modules then the mini project, final assessment and reflection, each row opening "What you'll learn". `#module-m2` and `#finale` open those rows |
| `/learn/courses/[courseId]/enroll` | Enrolling, in five steps: **About you** (seven profile questions, asked once and reused by later courses), **Preview** (a narrated course preview video, when the course has one; skippable), **Quick check** (12 ungraded questions that set help per module or lesson; can be skipped), **Customise** (adjust lesson order, field examples, role framing, help per lesson, explanations, comfort and pace, with live samples), **Build** (the course assembles, then "your course is ready"). On an enrolled course it opens on Customise; `?step=precheck` retakes the quick check |
| `/learn/profile` | The seven profile answers, editable, plus each course's quick check and setup |
| `/learn/plan` | Learning plan for enrolled courses: add a session on a chosen day, study days and session length, "Plan it for me" with undo, course outline, study calendar |
| `/learn/courses/[courseId]/[moduleId]/[stage]` | Module player. The module is laid out in numbered parts under side headings: The problem (the hook), Learn the ideas (one part per lesson video, `explainer?v=m1-2`), See it work, Build it, Apply it, Check yourself (a 6-question module check, 80% to pass) and Make it stick (spaced review). Each part says what you do in it and how long it takes; the same layout shows on the course page. The demo locks nothing (`lib/demo.ts`): every part opens and "Complete and continue" always works. Topics follow the setup answers. The problem hook (`hook`) is full screen with no rail, tutor or banners: an illustrated, narrated film the learner plays through at their own pace (sending the chatbot a message, opening the inbox, spotting the mistake, holding a button while the weekend passes), one spoken line on screen at a time and nothing gone until they continue; then your call with how sure you are, the replay step by step in time with the voice, and the verdict. A concept topic can be a set of narrated slide videos. Guided practice is a numbered, step-by-step build with values to copy and a check for each step. Scenarios (`lab`) give three new situations, each with evidence, a decision and a debrief. A module with no lessons yet shows a notice. Finishing a module opens the next one |
| `/learn/courses/[courseId]/finale/[step]` | Course finale after all modules: `capstone` (the brief; the learner marks the project done), `final-check` (80% pass mark), `wrap-up` (reflection, what you built, credential) |
| `/learn/reviews`, `/credentials`, `/history`, `/settings` | Learner pages. Settings lists each course's setup answers and applies larger text and reduced motion live |
| `/kit` | Component showcase with a light/dark theme toggle |

## Notes

- **Dark by default.** Both root layouts render the dark Aurora theme. Learners can switch the app to the light theme in Settings; an inline script applies it before paint. Moving between the two root layouts is a full page load (Next.js behaviour).
- **Tickers.** `NumberTicker` rolls digits into place when a number scrolls into view or changes. `TickerTape` is a scrolling strip with a pause button that pauses on hover and focus. Both show a static final state under reduced motion, from the OS or the learner's setting.
- **Motion.** Slow aurora drift (paused inside lessons), cursor spotlight on cards, page transitions, staggered entrances, animated progress, and a sliding nav pill. All of it switches off with reduced motion.
- **Gate answers are not in the UI data.** `src/data/mock-grader.ts` stands in for the server-side scoring endpoint and must be deleted when the API exists.
- **next-intl plugin is not used.** It loads `@swc/core`'s native binary, whose install script npm blocks by default. `next.config.ts` sets the one alias the plugin would add.
- **Enrolment, setup answers, progress, the plan, drafts and settings** live in `localStorage` (`lms-*` keys) until the API exists. Settings has a reset button.
- **Topics, not method names.** Every module shows its own topic titles in the method's order. The capstone, final check and wrap-up happen once, after all modules; modules are never locked. Method names live only in code (`src/lib/stages.ts`) and on `/kit`.
- **Adaptation.** Setup answers change the lessons, and a "Tuned for you" strip in the player says why. Field adds an "In your world" card. Role reframes the opening. "What helps first" reorders idea, example and try. Analogy preference opens the alternative explanation. Experience sets the support level.
- **Guided practice.** No multiple choice: numbered steps the learner does in the course's own tools. Each step has the actions, values to copy, a "You should see" check and a "Stuck?" tip (open by default for extra support). Steps done are saved per module.
- **Capstone.** The brief lists the requirements and edge cases; the learner builds the project and marks it done, which unlocks the final check.
- **Concept videos.** HTML/CSS slides synced to recorded narration (`public/audio/video-*.mp3`). Items on a slide appear as the narration reaches them. Each video pauses for two quick checks halfway and two at the end; a wrong answer gets a hint, not the answer. Controls: play/pause, slide track, speed, captions, chapters, transcript, mute, full screen; keyboard Space, arrows, M, C, F.
- **No invented numbers.** Ratings, reviews and career outcomes show empty states. Hours of manual work, for courses that set them, are labelled as course design estimates.
