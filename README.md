# LMS Platform — web UI

UI build for the LMS described in `ARCHITECTURE.pdf`. The plan is in [`ui-plan.md`](./ui-plan.md).
This phase is UI only: screens read mock data from `fixtures/`; there is no backend, auth or real course content yet.

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
| `fixtures/` | Mock data shaped like the content schema and data model: one course (Automate Real Work with n8n, five modules with topic titles), Module 1 in full, Module 2's guided practice, the course finale (capstone, final check, wrap-up), a learner, and the mock answer key. `fixtures/scripts/make-guided.mjs` writes the guided practice and its sample CSVs |
| `apps/web/public/samples/` | Sample data for guided practice: `nebula-leads.csv` (Module 1) and `nebula-signups-export.csv` (Module 2, 500 rows) |

## Routes

| Route | Screen |
|---|---|
| `/` | Marketing home (Aurora): hero, method bento, design rules, teams, pricing, FAQ, footer |
| `/auth/sign-in` | Sign in UI (email link + SSO; both lead into the demo) |
| `/learn` | Learner home. Before enrolment: course spotlight and how setup works. After: resume card, live KPIs, the setup the course is tuned to, course card, this week, reviews, assignments |
| `/learn/courses` | Catalog: one Coursera-style card per course with a draggable module carousel and "View details" |
| `/learn/courses/[courseId]` | Course details: hero, a "Set up for you" panel once enrolled ("Your course is ready" after enrolling), stats strip, sticky section nav with scroll-spy, each module's topic flow, and one outline list: five modules then the capstone, final check and wrap-up, each row opening "What you'll learn". `#module-m2` and `#finale` open those rows |
| `/learn/courses/[courseId]/enroll` | Enrolling, in four steps: **About you** (seven profile questions, asked once and reused by later courses), **Quick check** (12 ungraded questions that set help per lesson; can be skipped), **Customise** (adjust lesson order, field examples, role framing, help per lesson, explanations, comfort and pace, with live samples), **Build** (the course assembles, then "your course is ready"). On an enrolled course it opens on Customise; `?step=precheck` retakes the quick check |
| `/learn/profile` | The seven profile answers, editable, plus each course's quick check and setup |
| `/learn/plan` | Learning plan for enrolled courses: add a session on a chosen day, study days and session length, "Plan it for me" with undo, course outline, study calendar |
| `/learn/courses/[courseId]/[moduleId]/[stage]` | Module player: the module's own topics in order, adapted to the setup answers. Every module's concept topic is a set of narrated slide videos (three per module). Guided practice is a step-by-step build in the learner's own n8n, with a recreated n8n screen for every step. Module 1 is complete; Module 2 has its concept videos and guided practice; Modules 3–5 have their concept videos so far. Finishing a module opens the next one. Try `n8n/m1/guided` or `n8n/m2/guided` |
| `/learn/courses/[courseId]/finale/[step]` | Course finale after all modules: `capstone` (the brief, then the results once accepted), `final-check` (80% pass mark), `wrap-up` (reflection, what you built, credential) |
| `/learn/courses/[courseId]/finale/capstone/sandbox` | The capstone sandbox: an n8n-style editor (nodes panel, canvas, node details with parameters, settings, input and output). **Execute workflow** runs eight sample sign-ups; **Check project** grades against hidden launch-day tests. Work saves in the browser |
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
- **Guided practice.** No multiple choice: numbered steps done in the learner's own n8n. Each step has the actions, values to copy (expressions included), a recreated n8n screen (`src/components/n8n/screen.tsx`) with numbered marks matching the actions, a "You should see" check and a "Stuck?" tip (open by default for extra support). Steps done are saved per module.
- **Capstone sandbox.** `src/lib/sandbox/` runs workflows the way n8n does: one execution per new sheet row, items along connections, expressions in `{{ }}` (with `$json`, `$('Node')`, `$now` and a Luxon-style `DateTime`), Retry On Fail, On Error (stop, continue, error output). `src/data/mock-capstone-grader.ts` holds the hidden test rows and stands in for server grading. Accepted work shows a launch-hour run of 400 sign-ups through the learner's own workflow.
- **Concept videos.** HTML/CSS slides synced to recorded narration (`public/audio/video-*.mp3`, from the prototype, voice en-US-AndrewMultilingualNeural). Items on a slide appear as the narration reaches them. Each video pauses for two quick checks halfway and two at the end; a wrong answer gets a hint, not the answer. Controls: play/pause, slide track, speed, captions, chapters, transcript, mute, full screen; keyboard Space, arrows, M, C, F. Data: `fixtures/videos-n8n.json`.
- **No invented numbers.** Ratings, reviews and career outcomes show empty states. Hours of manual work automated per module are labelled as course design estimates.
