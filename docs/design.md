# Learning experience UI

The shared Nebula mark uses the supplied logo image at `public/brand/nebula-mark.png`, including the sidebar and course branding. The adjacent wordmark uses the foreground ink for “Nebula” and the theme-aware, text-safe brand accent for “KnowLab”; full wordmarks use a 34px mark and compact marks remain 28px.

The course details page omits the How it works section and its section-navigation link.

The course details page also omits the Reviews section and its section-navigation link.

The course details page omits the personalized “Set up for you” summary panel. Completing enrollment opens course details without a one-time setup banner.

The course journey omits the Small wins that matter and Made for your next step panels. The dashboard omits Focus Session and Today’s study sessions; the optional focus sprint remains available inside the course player.

The learner sidebar omits Reviews, Credentials and History on desktop and in the mobile menu. Their routes and search entries remain available.

The lesson header offers Show/Hide outline on desktop. Collapsing the current module sidebar gives the lesson more room; the display preference is stored per course in this browser and survives navigation. Narrow screens keep the existing outline drawer.

The updated course page leads with a mission, an Orbit Outdoor support-desk scene, and a six-chapter journey. Each chapter shows existing progress; the final course mini-project is shown once, before the final assessment. Original course details remain below this journey.

The lesson workspace adds a compact phase rail, a visible support explanation, and learner-controlled guidance. Concept pages are the narrated videos with their quick checks; a video restores its saved slide. Extra guidance opens a lesson introduction and key ideas; lighter support collapses the key ideas. Guided practice follows the selected module support.

Pip is the course assistant: a plain round badge with a chat mark (`components/learning/assistant-avatar.tsx`), in the accent colour, so a field palette recolours it. Thinking shows typing dots and other reactions a single soft pulse; both stop under reduced motion. It works offline.

Pip has one launcher in the bottom-right corner: a round chat button showing the assistant badge, without a label or additional message badge. The lesson toolbar and learning-tools dock do not repeat the Pip action; opening the character is the consistent entry point throughout the course.

Guidance uses a source-linked chat and current-step shortcuts. The notebook is course-specific and saved in this browser. Assessment screens show a clear independent-work message and process guidance while hiding explanatory history and notes.

Module 1 opens its Scenarios phase with the animated “The address switch” roleplay. Learners supervise Scout through five scenes with voiced first-person narration, acted choice previews, and visible Goal, Trust, and Safety consequences. Progress persists locally; existing scenario cases remain available as optional bonus practice. The roleplay and its media work offline and honor reduced-motion preferences.

Scenarios show one case at a time: inspect evidence, choose, commit, see the consequence, compare reasoning, and optionally retry. Choices persist. The mobile layout stacks these areas.

Rewards recognize completed practice. Asking for hints never reduces XP or stars. Existing mission progress is retained. The journey celebrates chapters practised, reflections saved, and reviews recalled, rather than displaying invented activity.

Guided practice is delivered as a six-phase mission: Understand, Configure, Connect, Test, Repair, and Launch. A single phase rail replaces competing progress maps, while each activity identifies its mission phase and the immediate technical task. The opening briefing uses a live incident, a compact pre-flight check, and a Scout build-status diagram. As the learner progresses, the diagram brings the workspace, secure connection, first response, memory, and field test online. Existing terminal, code, decision, and chat simulations remain the source of completion; the animation visualizes real progress and respects reduced-motion preferences.

An authored `solved_case` replaces that mission treatment when a module has a documented reference implementation. Module 1 uses Anthropic's published Customer Service Agent cookbook. Its guided practice identifies the original limitation, explains the completed architecture, walks through five implementation decisions with short code patterns, and ends with the notebook's recorded lookup and cancellation results. The source and its use of synthetic records remain visible throughout. This view omits fictional mission dialogue, XP, badges, branching scenarios, and decorative animation so attention stays on the existing problem and verified solution.

New styles live in `components/learning/learning.css`. Colours come from shared tokens, layouts collapse for mobile widths, controls have visible focus states, and hover motion is removed for reduced-motion preferences. Pip has no continuous bouncing animation or unsolicited popups, with one exception: the welcome tour below.

**Field palettes.** `<html data-accent="…">` swaps the accent family (`--accent`, `-ink`, `-deep`, `-soft`, `-line`) for IT, manufacturing, retail, finance, healthcare and education. Students and typed fields keep the brand indigo. Each palette is contrast-checked in both themes:
- text ink at least 5.6:1 on the light `--bg`, and 10:1 on the aurora `--bg`;
- white on `--accent-deep` at least 5.5:1.

The palette is set from the saved profile (`FieldAccentSync`) and stored in `lms-prefs`, so it applies before paint.

**Pip's interview** (`components/onboarding/interview-chat.tsx`, "About you" and a course's "This course" step) is a chat app, not a form:
- a chat panel with its own scroll, a header showing Pip's status ("Typing…", "Question 3 of about 8") and a progress line, and a composer pinned at the bottom (Skip, type your own answer, send);
- the current question is a highlighted card; its answers are numbered option cards in a two-column grid, picked by click or number key (1–9; Enter sends several);
- Pip's typing dots while the server writes the next question (`.typing-dots`, still under reduced motion);
- beside it on wide screens, "Your profile" (or "For this course") fills in answer by answer with a progress ring, the questions still to come as placeholders, and a note on what the answers change;
- "Start again" asks before clearing; the end card lists what Pip heard and the way on.
The server returns `progress` (answered, about how many remain) with every turn for the counters.

**Pip's welcome tour.** The first time an enrolled learner opens a course page, Pip gives a three-stop tour: progress, the path, and Pip itself (`components/onboarding/pip-tour.tsx`, stops marked with `data-tour`).
- It dims the page, rings each stop, and moves focus into its card.
- Esc or "Skip tour" ends it, and it never returns on its own.
- Settings has "Replay Pip's tour", and `?tour=1` opens it on request.

## Browser acceptance checklist

1. Open the course page at desktop and 390px mobile widths in both themes; check overflow and focus outlines.
2. Sign in (try "Continue with Google"). With no profile yet, Pip's welcome chat opens first; finish it (try the number keys), then enroll through the "This course" and customise steps.
3. Open a concept lesson. Advance a slide, answer its quick check, then reload and confirm the saved slide.
4. Open Pip, ask a course question, follow its reference, save an explanation, and reopen the notebook after a reload. Ask an unrelated question and verify the scope response.
5. Change guidance, visit guided practice, and request a hint. Confirm the completed checkpoint earns the same XP.
6. Commit and revise scenario decisions; reload and confirm the chosen decision persists.
7. Fail a module quiz: the retry and remediation remain available, while the next module stays locked in the map, course outline, and direct URL. Retry and pass; the next module should unlock.
8. In the passed-quiz result, write a reflection and inspect the scheduled return visits. Practise a future review; its future date must remain scheduled. Request tomorrow's practice and confirm the updated date on the Reviews page.
9. On a desktop-height viewport, open a concept, guided practice, scenario and module quiz. Confirm the course header stays visible, the activity remains inside one focused workspace, and the page does not grow by one screen per action.
10. Switch guidance between Extra, Balanced and Light. Extra should reveal help earlier, Light should collapse optional evidence, and the same scenario and assessment content must remain available at every level.
9. Open the course mini-project and final assessment; verify order, assessment boundaries, keyboard access, and the absence of duplicate tutor launchers.

These browser checks were not completed in the Codex session: Windows denied the native path-resolution calls needed by the Next.js development server. TypeScript, source validation, logic tests, and server-render checks are separate from visual verification.

Module and lesson navigation uses concise display labels, one part number, completion state, and duration. Descriptive subtitles are removed from both ModuleMap variants and journey chapter cards. Full teaching content and narration remain intact; labels are centralized in `src/lib/course-labels.ts`.

The course journey now presents one connected game: a compact level/XP/streak/Sparks status bar, one actionable daily mission, six Scout capability upgrades, three mastery stars per module, meaningful badges, and a single Launch Day final mission. Rewards use the existing theme tokens and real progress only. Locked upgrades remain understandable, completed modules use the success palette, and reduced-motion settings disable card movement. Mobile layouts stack the mission CTA, status items, capabilities, and badges without hiding progress.
# Course player width and focus dock

On desktop displays at least 1500 px wide, the course player uses a two-column learning workspace beside the module map. The lesson owns the flexible center column and a 270 px learning dock uses the remaining area for the focus sprint, current mission, progress, next step, and contextual tools. The dock disappears below that breakpoint so the activity remains the only focal surface on narrower screens.

The focus sprint is voluntary and offers 10, 15, and 25 minute choices. It does not force full screen, record tab changes, or penalize stopping. Progress and rewards describe real course actions. Course tools open the existing Pip and notebook surfaces rather than duplicating them.

Concept lessons use two sibling surfaces instead of one enclosing lesson card. The first box contains the lesson heading and complete media experience: slide, caption, progress, playback controls, and transcript. The second box contains adaptive guidance, field-specific examples, and key ideas. A separate action bar follows both boxes. This keeps the video and related reading visually independent while preserving a natural top-to-bottom order on every screen size.

Visual Story mode turns authored concept slides into focused scenes with touch, keyboard, swipe, and marker navigation. It retains lesson audio, captions, checks, saved position, and completion rules.

Pip uses the updated illustrated mascot and gives brief, phase-aware nudges and reactions to learner actions. Reactions respect reduced-motion preferences.


### Scenario-based starting activity

The Google-connected enrollment uses simple narrated HTML slides and one evolving mission. The workspace places a fictional incoming request, an editable agent workflow and the last simulated outcome on one canvas. An action tray lets learners add tools/actions, reorder them with keyboard-accessible controls, and run a configuration. A packet follows the chosen actions and highlights the currently illustrated step while the model generates the result; this animation does not claim real tool execution. The next scene continues the same mission and keeps surviving actions plus instructions for revision. There is no question counter or standalone questionnaire. Source facts are part of the incoming request. Audio is optional; system and learner reduced-motion preferences disable packet movement/layout motion. Short events and results supply context without a wall of assessment details.
