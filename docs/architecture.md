# Current learning experience extension

This document covers the October 2026 learning UI changes in `apps/web`. The root architecture document describes an older Vite prototype; this app uses Next.js, React, TypeScript, and browser-local persistence.

## Course flow

Enrollment keeps profile → introductory preview → prior-knowledge check → customization. Existing module stage identifiers and completion keys are unchanged. The visible module journey is problem/hook, concept, worked example, guided practice, scenarios, then one module quiz. Passing the quiz reveals reflection and schedules the 3/10/30-day reviews in the same result view. Scheduled reviews retain their direct route. The finale still has exactly one course mini-project (`capstone`), immediately followed by `final-check`, then `wrap-up`.

## Course companion

`app/(app)/learn/layout.tsx` builds a teaching-only passage index on the server. `lib/companion.ts` excludes assessment questions, answer keys, and scenario solutions. The client provider selects the current course from the route and registers transient step context from video slides, worked examples, guided checkpoints, and scenarios. Unmounting a registered context releases it.

Pip is an extractive course companion, not a connected language model. It retrieves authored course explanations with links, handles current-step guidance and hints, and declines questions without a sufficiently strong course match. It has no external service, web access, microphone, or action execution. The UI discloses this limitation. Chat is held in memory; course notes persist locally.

Prechecks, module gates, and the final assessment allow process guidance only. The chat history and notebook are hidden there. The reply policy independently enforces this boundary, including shortcut questions. This is a client-side demonstration, not a secure exam environment.

## Adaptation and persistence

`learning-rules.ts` contains pure guidance and review-scheduling functions. Starting support comes from the existing profile/precheck. Recent practice can add or reduce scaffolding; an explicit module preference or existing enrollment override takes precedence. Three independent successes can lighten guidance; two recent failures request extra guidance. Final assessment difficulty is unchanged. Responses after feedback and checklist-only confirmations do not count as independent success.

New state is separate from the existing stores:

- `lms-learning:v1:{courseId}` (schema V2): support choices, bounded practice evidence, reflections, notebook, review schedule, meaningful activity days, and the last visited lesson URL.
- `lms-video-position:v1:{courseId}:{videoId}`: slide, playback/check phase, completed checks, and seen slides. Videos resume paused at the saved slide.
- `lms-prediction:v1:{courseId}:{moduleId}`: initial hook prediction, revisited during reflection.
- `lms-decisions:v1:{courseId}:{stepId}`: scenario decisions.
- `lms-roleplay:v1:{courseId}:{stepId}:{missionId}`: roleplay scene, committed decisions, Goal/Trust/Safety signals, hint use, and completion.
- `lms-gate:v1:{courseId}:{checkId}`: actual graded outcome and module-unlock authority. Module quizzes cannot use demo continuation; a pass unlocks the next module. Direct player URLs use the preceding module's saved result as the same guard.

Review tickets start at 3, 10, and 30 days. Scheduling is idempotent. A difficult review can return tomorrow. Early successful practice leaves the future ticket scheduled. The course page and Reviews page display these tickets. No background notifications or server scheduler were introduced.

## Focused module delivery

The player uses a viewport-sized `StageShell` on desktop. Its topic header and action footer remain visible while only the current activity pane scrolls. The adaptive control bar stays compact and exposes the current support behaviour plus the learner override. Guided missions and scenarios use two panes so the brief or evidence remains beside the action. Mobile returns to a natural single-column document.

The activity unit is deliberately small: one video slide, worked-example frame, guided waypoint, roleplay scene, scenario case, or quiz question at a time. Module 1's authored roleplay is stored on its lab block and uses deterministic decision effects, so it works offline and remains auditable. Each roleplay scene owns a first-person Nia narration string; committed female-voice MP3 clips live at `public/audio/roleplay-{missionId}-s{sceneIndex}.mp3` and are regenerated through the existing audio script. Transparent 3D WebP characters live in `public/images/roleplay/`; CSS stages their movement, scene props, dialogue, visual choice previews, and consequences inside one cinematic frame. Completing the roleplay satisfies the Scenarios stage; the three previous transfer cases remain optional bonus practice. Its outcome is recorded as one learning attempt for adaptive support, while the module quiz remains the only unlock authority. Module quizzes keep all responses in memory while the learner moves through a numbered question navigator. In this review fixture, every module answer key is option A so the prototype can be inspected consistently. Scenario support uses the same computed support level as guided practice: extra support reveals the first hint and opens evidence, balanced support offers hints after a try, and light support starts with evidence collapsed. This changes scaffolding and presentation only; assessment questions and pass thresholds remain fixed.

The six new experiments are authored deterministic simulations in `data/experiments.ts`. They do not run arbitrary code, call live models, or change course completion. The learner chooses behaviour, predicts an outcome, tests normal and unexpected cases, and records transfer reasoning.

## Validation

Run from the repository root:

```text
node node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.json
node --test apps/web/tests/learning-experience.test.cjs
node fixtures/scripts/build-ai-agent.mjs --check
npm run build
```

The focused tests cover adaptation, isolated persistence, review timing, scoped retrieval, assessment boundaries, course sequencing, and React server rendering of the new journey and all six experiments. Browser interaction checks are still required before release. The authoring validator currently reports nine existing missing-simulator warnings for module 5.

Pip now receives the active video ID and slide title. Retrieval requires a match in the teaching text itself, ranks exact authored definitions and individual key ideas above narrative introductions, and uses lesson context to break ties. Generic “explain this” requests use the current step. Assessment boundaries remain unchanged.

## Gamification

`lib/gamification.ts` derives the game layer from existing evidence instead of maintaining a second completion system. Completed stages, watched videos, unique practice attempts, reflections, spaced reviews, and finale steps produce XP. Repeating the same saved action cannot farm XP. Hints never reduce XP or mastery stars. Levels, Sparks, badges, Scout upgrades, module mastery stars, and the daily mission are all deterministic views of the same course progress.

Learning state is now schema version 2 and adds a bounded list of meaningful activity days. Version 1 data migrates in memory, reconstructing available activity from attempts and completed reviews, and is written as version 2 on the next learning action. The existing `lms-learning:v1:{courseId}` storage identifier remains stable so current browser data is not abandoned. Stage, video, and finale completions record activity; experiments and reviews already record it through practice evidence. Streaks allow the current day plus one recovery day.
# Focus session state

The course-player focus sprint uses the course-scoped localStorage key `lms-focus:v1:<courseId>`. Its small state contains the selected duration, seconds remaining when paused, and an absolute `runningSince` timestamp while active. An absolute timestamp keeps the countdown accurate across route changes and background throttling. It is intentionally separate from learning evidence and gamification state: starting or finishing a timer never grants mastery or XP.

The wide learning dock communicates with existing course surfaces through browser events. `pip:notes` opens Pip directly on the notebook tab when assessment rules allow it, and `learning:experiment` changes the current workspace to the experiment tab. Assessment restrictions remain enforced by the companion itself.

