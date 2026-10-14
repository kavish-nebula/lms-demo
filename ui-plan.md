# UI Build Plan - LMS Platform websites and app shells

Status: draft v1 (2026-10-07). Scope: user interface only. No course content, no backend wiring.
Inputs: ARCHITECTURE.pdf, architecture-diagram.pdf, agents.md, architecture.md, design.md,
backend-plan.md, ch13-ild-pipeline-framework.html, three reference images, and three reference sites
(getlayers.ai, dribbble.com/tags/liquid-ui, 21st.dev UI Layouts).

---

## 1. What the documents say, reconciled

| Source | What it fixes for the UI |
|---|---|
| ARCHITECTURE.pdf (draft v1, 2026-10-01, "source of truth") | Next.js App Router + React + TypeScript + next-intl. Six scoped roles. Seven frontend surfaces (section 2). 9-stage module player, V1 ships stages 1-4, 7, 8, 9. Multilingual from day one. |
| design.md | The "Frosted Aura" design system: warm paper neutrals, frosted white cards, indigo accent, DM Sans + JetBrains Mono, token names (`--bg`, `--accent`, `--fs-*`, `--s*`, `--r*`), 900px breakpoint, accessibility floor. |
| architecture.md + agents.md | The existing prototype (Nebula KnowLab): React 19 + Vite, JSX, hand-written CSS, Zustand, no CSS framework. Existing component inventory (TopNav, GlassCard, ProgressRing, ModuleRail, QuestionDialog, CredentialCard, PatchDock...). |
| ch13 ILD Pipeline Framework | The 9-step module template with Bloom level, load and duration per step. Four assessment layers. Templates T1-T10 (field lists become component props). Stage 8 analytics dashboard spec with healthy ranges and red flags. Pipeline stages, gates, version scheme (Major.Minor.Iteration), module tracking card. Hard rule: zero decorative elements inside learning materials. |
| backend-plan.md | FastAPI/AWS plan for the prototype. Conflicts with the PDF (Next.js on GCP Cloud Run). Out of scope for UI, but it confirms the data shapes the UI must render (progress events, attempts, credentials, adaptation log). |

Conflicts that change the UI work (decisions needed, see section 11):

1. **Stack.** PDF says Next.js + TypeScript. Prototype docs say Vite + JSX + no CSS framework. The reference sites (21st.dev) ship Tailwind + shadcn components.
2. **Theme.** design.md is light "paper". Reference image 1 is a dark violet aurora. Images 2 and 3 are light dashboards.
3. **Product name.** Prototype is "Nebula KnowLab" (package `proofcraft`). The PDF never names the product.
4. **"Forma".** design.md cites `forma/index.html` as a light LMS template. GetLayers also sells a "Forma" template, but it is a dark agency contact page, so it is probably not the same file.

---

## 2. Surfaces to build

From ARCHITECTURE.pdf section 2 plus a public marketing site.

| # | Surface | Role | Reference |
|---|---|---|---|
| S0 | Marketing site (home, pricing, for-teams, about, contact, legal) | Public | Image 1 (dark aurora hero), GetLayers templates |
| S1 | Auth (sign in, SSO button, invite accept, forgot password, role switcher) | All | 21st.dev password/phone inputs |
| S2 | Learner home ("continue learning", due reviews, assignments) | Learner | Image 3 (SkillUp) |
| S3 | Catalog and course home (modules, stages included, estimated time) | Learner | Image 3 course cards |
| S4 | Player: 9-stage module runner + tutor dock | Learner | ch13 templates T1-T8 |
| S5 | Credentials, history, profile and settings (locale, accessibility) | Learner | existing CredentialCard |
| S6 | Instructor cohort view (assigned learners, who is stuck, message) | Instructor | Image 2 tables |
| S7 | Org dashboard (seats, learners, assignment, progress, entitlement window) | Org admin | Image 2 KPIs + chart |
| S8 | Content workspace (pipeline board, module tracking card, validator results, versions) | Content creator | ch13 section 6.2 |
| S9 | Review page (block-level comments, tags, severity, approve/reject) | Reviewer | ch13 Stage 3 and 5 |
| S10 | Admin console (orgs, users, scoped role assignments, entitlements, internal analytics, audit log) | Super admin | Image 2, ch13 Stage 8 |

---

## 3. Visual direction

Two themes, one token set.

**Aurora (dark)** for S0 marketing and the auth screens. Taken from image 1: near-black plum
background, one violet radial glow, white headline with violet highlight word, ghost + filled CTA pair,
device mockups, a prompt-style input as the primary call to action, a stat pair under the hero.
GetLayers is the reference for motion: a hero that assembles itself, cursor-reactive gradient,
cards that cascade in, carousel sections. We reproduce the feel with CSS and `motion`, not WebGL.

**Frosted Aura (light)** for every signed-in surface, as already defined in design.md. Images 2 and 3
confirm the pattern: warm off-white canvas, white cards with hairline borders, one accent, icon-led
sidebar, KPI row, charts with range tabs, tables with avatars and delta chips.

**Liquid glass** (Dribbble tag, 21st.dev "Sidebar Liquid Glass", "Liquid glass icons") is an accent
material, not a layout. Use it on: sticky top bars, the app sidebar, the floating tutor dock, hero
cards on the marketing site, toasts and command palette. Never use it behind learning text. ch13 bans
decorative elements in learning materials, and glass contrast depends on what scrolls underneath.
Recipe: translucent fill, 1px translucent border, inset 1px top highlight, blur 8-16px, solid
fallback inside `@supports not (backdrop-filter: blur(1px))`, reduced blur under 768px.

**Typography and shape** stay as design.md: DM Sans, JetBrains Mono, radii 10/16/20, spacing 4-48,
soft large-blur shadows.

---

## 4. Token layer (extend design.md, do not replace)

Keep every existing token name. Add:

| Group | New tokens | Notes |
|---|---|---|
| Theme switch | `[data-theme="aurora"]` overrides for `--bg`, `--panel`, `--line`, `--text`, `--muted`, `--faint`, `--shadow-*` | Marketing and auth only. App never flips theme in V1. |
| Glow | `--aura-1` (violet), `--aura-2` (coral), `--aura-size`, `--aura-opacity` | The two radial washes already described in design.md, now parameterised so Aurora can turn them up. |
| Glass | `--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-blur-sm/md/lg`, `--glass-shadow` | One recipe reused by TopBar, Sidebar, TutorDock, Toast, CommandPalette. |
| Charts | `--chart-1..6`, `--chart-grid`, `--chart-muted` | Indigo-led categorical set, contrast-checked on `--panel`. |
| Stage colours | `--stage-hook`, `--stage-explain`, `--stage-worked`, `--stage-guided`, `--stage-lab`, `--stage-project`, `--stage-gate`, `--stage-reflect`, `--stage-review` | Soft fill + line + ink triple per stage, same pattern as status colours. |
| Motion | `--dur-1..3`, `--ease-out`, `--ease-spring` | Every animation reads these and collapses under `prefers-reduced-motion`. |

Rule carried over: components use tokens, never raw hex. Status colours always pair soft fill +
line + ink.

---

## 5. Component inventory

Four tiers. Each row names the reference it is copied or adapted from.
"21st" = 21st.dev UI Layouts (MIT, shadcn-registry installable). "prot." = existing prototype component.

### Tier 1 - primitives (week 1)

| Component | Variants / props | Reference |
|---|---|---|
| Button | primary, secondary, ghost, danger, icon-only, loading, size sm/md/lg, as link | prot. `.btn`, 21st Button (magnetic hover for marketing only) |
| Chip / Badge | status (ok/warn/err/info), stage, count, removable | prot. `.chip` |
| Input, Textarea, Select, Combobox | label, help, error, prefix icon, char count | 21st Password Input, Phone Input, Tags Input, Multi Selector, Datetime Input |
| Checkbox, Radio, Switch, Slider | group variants | shadcn base |
| Tabs, SegmentedControl | underline (page), pill (range tabs like image 2: 12m/3m/30d/7d/24h) | image 2 |
| Card, GlassCard | pad md/lg, hover lift, header/footer slots, glass | prot. GlassCard, 21st Sidebar Liquid Glass |
| StatTile | value, label, delta chip, icon, status (healthy/red-flag), sparkline slot | images 2-3, 21st Stats Bento, Motion Number |
| ProgressBar, ProgressRing | determinate, segmented (per stage), label inside/outside | prot. ProgressRing, image 3 |
| Avatar, AvatarGroup | initials fallback, status dot | image 2 |
| Table | sortable headers, sticky header, row actions, selectable, empty, loading | image 2 Top Courses / Leaderboard |
| Pagination, Breadcrumb | cursor and page modes | - |
| Dialog, Drawer, Sheet | sizes, destructive confirm, directional drawer | prot. QuestionDialog, 21st Directional Drawer, Animated Dialog |
| Popover, Tooltip, DropdownMenu | keyboard navigable | shadcn base |
| Toast, Banner | success/info/warn/err, action slot, glass toast | - |
| Skeleton, ShimmerLoader, EmptyState, ErrorState | - | 21st Shimmer Loader |
| CommandPalette / Search | Ctrl+K, grouped results | image 3 search |
| CodeBlock, TreeCodeViewer | copy, line highlight, language label | 21st Code Block, Tree Code Viewer (worked examples for technical courses) |
| Accordion, MultiAccordion | FAQ, module list | 21st Multi Accordion, FAQ Tabbed Explorer |
| Icon | lucide wrapper, size tokens | existing choice |
| VisuallyHidden, FocusRing, SkipLink, LiveRegion | a11y helpers | design.md section 6 |

### Tier 2 - composites (week 1-2)

| Component | Purpose | Reference |
|---|---|---|
| AppShell | sidebar + glass top bar + content + optional right rail, 900px collapse | images 2-3, prot. TopNav |
| Sidebar | icon + label nav, active pill, collapsed mode, role switcher at top, user menu at bottom | image 2-3, 21st Sidebar Liquid Glass |
| TopBar | search, notifications bell, locale picker, avatar menu | image 2 |
| MarketingShell | transparent nav over aurora, footer bento | image 1, 21st Footer Bento |
| PageHeader | title, description, actions, tabs | - |
| KpiRow | 3-5 StatTiles, responsive wrap | images 2-3 |
| ChartCard | title, legend, range tabs, chart slot (bar, line, donut, funnel, sparkline) | image 2 Analysis + Student Queries |
| DataTableCard | Table + toolbar (search, filters, export) | image 2 |
| CourseCard | cover, title, progress bar, "4/10 lessons", stage chips, resume CTA | image 3 |
| ModuleCard / ModuleRow | stages included, est. minutes, locked/unlocked, gate state | prot. ModuleRail |
| ResumeCard | "continue where you left off" with stage name and time left | prot. Dashboard |
| DueReviewList | spaced-review items due today / this week | ARCHITECTURE.pdf section 11 |
| DailyProgressList, UpcomingList | small lists for learner home | image 3 |
| LeaderboardTable | rank, trend arrow, avatar, points (optional, SDT relatedness) | image 2 |
| NotificationPanel | grouped by day | - |
| LocaleSwitcher, FallbackNotice | "not yet translated, showing base language" | PDF section 9 |
| ConsentPrompt | microphone (voice tutor), email reminders | PDF sections 8, 11 |

### Tier 3 - learning stage components (week 3)

One component per stage block in the Zod schema (PDF section 6). Props mirror the schema fields.
Each has an `Intro` state, a `Body`, and a `Done` state. Visual rule: calm, no glass, one idea per screen.

| Stage | Components | Fields from ch13 / schema |
|---|---|---|
| 1 Hook | `HookStage`, `ScenarioCard`, `ObjectiveLink` | scenario, media, objective link; 2-3 min |
| 2 Explainer | `ExplainerStage`, `ConceptChunk` (max 4-5 concepts), `SegmentedVideo` (5-12 min, chapter markers, captions, transcript toggle), `ConceptCheck` (inline, every 3-5 min, not graded) | T1 Video Lesson |
| 3 Worked example | `WorkedExampleStage`, `StepWalkthrough` (what/why/action/result per step), `FadingLevel` switch (full -> partial -> independent), `KeyTakeaway`, `YourTurnPrompt` | T3 |
| 4 Guided practice | `GuidedPracticeStage`, `PracticeItem` (MC, fill-in, drag-drop, short code), `TieredHints` (hint 1/2/3, counts hint use), `InstantFeedback` (under 2 s, never just "wrong"), `AutoGradeResult` | T2, T3, PDF schema |
| 5 Scenario lab | `ComingSoonStage` placeholder with schema-shaped stub | not V1 |
| 6 Mini project | `ComingSoonStage` placeholder | not V1 |
| 7 Mastery gate | `GateIntro` (objectives tested, pass 80%, retry 24 h, new variants), `QuestionRunner` (seeded order, one submit, no feedback until submit), `GateResult` (pass/fail, per-objective bars), `RemediationRoute` (links to the exact chunk / worked example / practice item) | T5 |
| 8 Reflection | `ReflectionStage`, `ReflectionPrompt` x3 (what worked / what failed / what transfers), min-sentence hint, completion-only | T6 |
| 9 Spaced review | `SpacedReviewStage`, `ReviewQuiz` (interleaved, "from Module N" tag, new-context badge, one Bloom level up) | T7 |
| Shell | `PlayerShell` (stage rail with 9 slots, grey-out missing stages, progress, time estimate), `StageShell` (title, Bloom chip, duration chip, prev/next), `TutorDock` (glass, cites sources, "outside this course" state, AI disclosure, gate-locked notice, mic button behind consent) | prot. Player, PatchDock; PDF section 8 |

### Tier 4 - staff and admin composites (week 4)

| Component | Surface | Fields |
|---|---|---|
| `CohortTable`, `StuckPointBadge`, `MessageLearnerDrawer` | S6 | stalled > N days at stage X |
| `SeatMeter`, `EntitlementCard` (valid_from/to, seats, access_after_expiry), `AssignCourseDialog` | S7 | PDF section 5 |
| `PipelineBoard` (8 columns, gate stamps between), `ModuleTrackingCard` (ch13 6.2 fields), `VersionBadge` (Major.Minor.Iteration), `ChangeLogTable`, `ValidatorResultList` (schema, grounding, alignment, pedagogy, code, independent solve, leakage) | S8 | ch13 sections 6.1-6.2, PDF section 7 |
| `ReviewSplitView` (block on left, cited source on right), `BlockComment` (tag factual/pedagogy/domain/tone/structure, severity, block ID), `ApproveRejectBar`, `RubricScorer` (9 dimensions, 0-3, 85% threshold, zero Not Met) | S9 | ch13 Stage 3, 5 |
| `OrgTable`, `UserTable`, `RoleAssignmentEditor` (role + scope type + scope id), `AuditLogTable` | S10 | PDF section 4 |
| Analytics widgets: `CompletionTile`, `DropOffFunnel` (by stage), `GatePassTile`, `TimeOnTaskTile`, `ItemAnalysisTable` (difficulty 0.3-0.7, discrimination > 0.2), `SatisfactionTile`, `RetentionCurve` (+1/+3/+6) | S7, S10 | ch13 Stage 8 spec with healthy and red-flag thresholds baked into StatTile status |

### Marketing sections (week 2)

Navbar (glass, ghost + filled CTA), AuroraHero (headline with accent word, prompt-style input CTA,
device mockups, stat pair), LogoMarquee, FeatureBento (9-stage method), HowItWorks (horizontal
stage scroller), OutcomesStats (Stats Bento), Testimonials, Pricing (B2C / B2B tabs), FAQ
(tabbed explorer), CtaBand, FooterBento. References: image 1, GetLayers "Cards Cascade",
"Roadmap Ascent", "Carousel Spotlight" sections, 21st Hero AI Value Proposition, Feature Bento,
Pricing Section, Testimonial, Scroll Text Marquee, Mesh Gradient Background.

---

## 6. Screen inventory (what gets assembled from the inventory)

| Route group | Screens | Built from |
|---|---|---|
| `/` (marketing) | Home, Pricing, For teams, About, Contact, Privacy/Terms | marketing sections |
| `/auth` | Sign in, SSO, Invite, Forgot, Role switcher | Tier 1 forms, Aurora theme |
| `/learn` | Home, Catalog, Course, Player (`/learn/[course]/[module]/[stage]`), Credentials, History, Profile, Settings | Tier 2 + Tier 3 |
| `/instruct` | Cohort, Learner detail | Tier 4 |
| `/org` | Dashboard, Learners, Courses, Entitlements | Tier 4 |
| `/content` | Workspace board, Module card, Versions | Tier 4 |
| `/review` | Queue, Review split view | Tier 4 |
| `/admin` | Orgs, Users, Roles, Entitlements, Analytics, Audit | Tier 4 |
| `/kit` | Internal component showcase (every component, every state, both themes) | all |

`/` redirects by role priority once auth exists; in the UI phase the `/kit` page links to every
screen with mock data.

---

## 7. Recommended tech approach

- **Framework:** Next.js App Router + TypeScript, as ARCHITECTURE.pdf decides. One codebase for marketing and app.
- **Styling:** Tailwind v4 with the design.md tokens declared once as CSS variables in `@theme`, plus shadcn/ui as the primitive base. This lets 21st.dev UI Layouts components install through the shadcn registry unchanged. It replaces agents.md rule 6 (no CSS framework) and needs sign-off.
  Fallback if the team keeps hand-written CSS: same tokens, same inventory, 21st.dev components are ported by hand (about 2x the effort for Tier 1).
- **Motion:** `motion` (Framer Motion), variants centralised, `MotionConfig reducedMotion="user"` at the root, as the prototype already does.
- **Icons:** lucide-react. **Fonts:** DM Sans + JetBrains Mono via `next/font`.
- **Charts:** Recharts with the `--chart-*` tokens. Donut, bar with range tabs, line, funnel, sparkline.
- **i18n:** next-intl from the first component. No hard-coded strings. Test with a long-word locale (German) in `/kit`.
- **Data:** `fixtures/` JSON shaped like the Zod content schema and the data model in the PDF (one module with all 9 blocks, learners, orgs, events). Screens read fixtures through a thin `data/` layer so the API swap is mechanical.
- **Showcase:** `/kit` route (faster than Storybook for a two-person team). Every component appears in every state, both themes, three widths.
- **Repo layout:** `apps/web` (Next.js), `packages/ui` (components + tokens), `packages/content-schema` (Zod, already planned), `fixtures/`.

---

## 8. Build order and estimate

| Week | Deliverable | Done when |
|---|---|---|
| 1 | Repo, tokens, both themes, fonts, AppShell, MarketingShell, Tier 1 primitives, `/kit` | Every primitive shown in `/kit` in both themes, keyboard-tested |
| 2 | Marketing home + pricing, auth screens, Tier 2 composites | Lighthouse a11y 100 on home, hero motion respects reduced motion |
| 3 | Learner home, catalog, course, PlayerShell, 7 V1 stage components, TutorDock, settings | A full mock module can be clicked through hook -> spaced review |
| 4 | Instructor, org, content workspace, review page, admin, analytics widgets | Every surface in section 2 renders from fixtures with empty, loading and error states |
| 5 (buffer) | Audit: contrast on glass, 200% text zoom, screen reader pass, mobile, i18n length | Issue list closed |

This maps onto weeks 1-4 of the PDF's 3-month plan ("repo, CI, i18n scaffolding" and "role-based
landing pages") so backend work can start against stable screens.

---

## 9. Rules every component follows

1. Tokens only. No raw hex, no new shadows, no new radii.
2. Both themes render. Glass has a solid fallback.
3. Keyboard reachable, visible `:focus-visible`, 4.5:1 text contrast measured on the real backdrop.
4. Reduced motion path exists and is tested.
5. Works at 360, 768, 1280 px. Side padding `clamp(16px, 3vw, 44px)`.
6. Strings through next-intl. Numbers and dates through `Intl`.
7. Empty, loading and error states exist for every data component.
8. Learning content components: no decoration, one idea per screen, concept checks inline (ch13 Mayer rules).
9. Nothing in the UI reveals mastery-gate answers or shows learners scores framed as levels (prototype product rule carried forward).
10. Listed in `/kit` with its props documented in a short comment.

---

## 10. What the reference sites contribute

- **GetLayers** (52 templates, 33 dark / 19 light; categories include Sports/Education x4). Prompt-driven, WebGL-heavy heroes. We borrow motion ideas (self-assembling hero, cursor-reactive gradient, card cascade, roadmap section) and keep them CSS-only. Premium prompts need a licence if copied directly; nothing in this plan depends on buying one.
- **Dribbble "Liquid UI"** (12 shots). The useful pattern is Apple-style liquid glass: translucent panels over imagery, lit top edge, pill controls, floating nav. Used here as accent material (section 3).
- **21st.dev UI Layouts** (127-129 components, MIT, shadcn registry, "Copy prompt" and CLI install). Directly reusable: Sidebar Liquid Glass, Liquid glass icons, Stats Bento, Feature Bento, Draggable Grid Dashboard (swapy), Pricing Section, FAQ Tabbed Explorer, Multi Accordion, Testimonial, Footer Bento, Code Block, Tree Code Viewer, Password/Phone/Tags inputs, Multi Selector, Datetime Input, Shimmer Loader, Motion Number, Directional Drawer, Animated Dialog, Mesh Gradient Background, Scroll Text Marquee.
- **Web note on glass:** CSS `backdrop-filter` cannot refract, so "liquid" on the web is blur + translucency + a top-edge highlight; keep it off text-heavy areas and off continuously scrolling regions on low-end devices.

Sources: getlayers.ai/templates, getlayers.ai/sections, getlayers.ai/layer/forma, getlayers.ai/layer/stride-nine,
dribbble.com/tags/liquid-ui, 21st.dev/@uilayout.contact/library/ui-layouts,
21st.dev/@uilayout.contact/components/sidebar-liquid-glass, 21st.dev/@uilayout.contact/components/default-swapy,
21st.dev/@uilayout.contact/components/stats-bento, buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026,
setproduct.com/blog/liquid-glass-vs-glassmorphism.

---

## 11. Decisions taken (2026-10-07)

| Question | Decision |
|---|---|
| Stack | Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui (Radix, "nova" preset) |
| Theme split | Dark Aurora everywhere by default (changed 2026-10-07); light Frosted Aura is a Settings option |
| Order | Learner side first (S0-S5) |
| Location | New `apps/web` in this folder, monorepo with `packages/ui`, `packages/i18n`, `fixtures` |

### Build status

Done: tokens for both themes, Tier 1 primitives, Tier 2 composites, the seven V1 stage components plus lab/project placeholders, tutor dock, marketing home, sign-in, learner home, catalog, course page, reviews, credentials, history, settings, `/kit`. Lint, type check and production build pass; every route fits a 375px phone without sideways scrolling.

Added 2026-10-07: Learning plan page (`/learn/plan`, ported from the prototype's plan engine), NumberTicker and TickerTape components, "Up next" ticker on the dashboard and plan, and GetLayers-style motion (aurora drift, cursor spotlight, page transitions, staggered entrances, animated progress, sliding nav pill). Motion pauses inside lessons and under reduced motion.

Added 2026-10-07 (later): the catalog is down to one course, Automate Real Work with n8n, ported from the guided-practice prototype with Module 1 in full (hook, explainer, worked examples, guided build, gate, reflection, review). Enrolment now starts with a six-question setup wizard whose answers adapt the player. Catalog cards follow Coursera's layout with a draggable module carousel. The course details page has a sticky scroll-spy section nav, an interactive nine-step method, an adaptation demo, outcomes, a module accordion and empty-state reviews. The dashboard and plan read enrolment and progress from the browser.

Restructured 2026-10-07: modules no longer contain the mastery gate, mini project or reflection. Each module lists its own topic titles in the method's order (no method names anywhere learner-facing), every module is open, and the course ends with a finale after all modules: the prototype's capstone ("Launch week, end to end"), a 12-question final check at 80%, and a wrap-up with reflection, what you built and the course credential.

Enrolment flow (2026-10-07): about you (the prototype's seven profile questions, asked once) -> an ungraded 12-question quick check that sets help per lesson -> an interactive customise screen -> a "Building your course" animation -> the course page with a "Your course is ready" panel. A Profile page edits the answers. The course outline lists modules and the three finale steps as rows; each row's arrow opens what you will learn.

Concept videos (2026-10-07): every module's concept topic is taught by narrated HTML/CSS slide videos ported from the prototype (15 videos, 144 slides, recorded narration), with mid and end checks, captions, speed, chapters, transcript and full screen. Modules 2–5 are concept-only for now. The finale is open at any time (prototype).

Hands-on practice (2026-10-07): guided practice has no multiple choice. Modules 1 and 2 each have a step-by-step guide done in the learner's own n8n (10 and 8 steps): every step gives the actions, values to copy, a recreated n8n screen (HTML/CSS, n8n 2.x dark) with the exact button or field numbered, and what you should see. Sample CSVs are generated so the counts are exact (Module 2: 500 → 459 → 376). The capstone is a real build in an in-app n8n-style sandbox (React Flow canvas, node details view with parameters, settings, input and output): the learner runs eight sample sign-ups, then checks the workflow against hidden launch-day tests. All eight requirements must pass; failures explain what went wrong, with an optional hint. Module 2's guided practice is now authored; finishing a module opens the next one.

Not started: S6-S10 staff consoles (Tier 4), real auth, API wiring, locales beyond English, Modules 2-5 content.

## 12. Still open

The questions below were not answered yet; the build uses the defaults noted.

1. **Name and brand:** keep "Nebula KnowLab" (current default), or a new name and logo mark?
2. **Forma:** is the `forma/index.html` in design.md the GetLayers "Forma" template or a different file? If GetLayers, is it licensed?
3. **Leaderboard:** image 2 shows one. ch13 warns against extrinsic rewards crowding out motivation. Default: left out.
4. **Languages:** which base language and which first locales, and whether RTL is needed. Default: English only.
5. **Pricing:** the marketing page shows placeholder prices, labelled as such.
