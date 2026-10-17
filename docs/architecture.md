# Current learning experience extension

This document covers the October 2026 learning UI changes in `apps/web`, merged with `ai-agent-backend`. The app uses Next.js, React and TypeScript. Enrollment, plans, course progress, Python projects, workflow projects and platform rewards remain backend-backed; the new practice notebook, review schedule and playback checkpoints are browser-local. See [adaptive-backend-merge.md](adaptive-backend-merge.md) for the integration decisions.

## Course flow

Signing in (email, company SSO or Google; all demo logins for now) leads to the dashboard, and a learner without a profile is first sent to Pip's welcome chat (`/learn/welcome`, `ProfileGate`). Enrollment then starts from that profile: Pip's questions about this course → customization → build. There is no course preview video step. The prior-knowledge quick check has been removed; enrollments that already have a result keep it, and the planner still reads it. Existing module stage identifiers and completion keys are unchanged. The visible module journey is problem/hook, concept, worked example, guided practice, scenarios, then one module quiz. Learn the ideas always comes before the worked example, with guided practice after both, regardless of saved learner preferences. Plans with an earlier worked example or practice are repaired (`practiceAfterExamples` in `lib/topics.ts`, applied by the plan validator and by `planTopicOrder` for plans saved before this rule). Passing the quiz reveals reflection and schedules the 3/10/30-day reviews in the same result view. Scheduled reviews retain their direct route. The finale still has exactly one course mini-project (`capstone`), immediately followed by `final-check`, then `wrap-up`.

The AI Agent capstone mini-project opens one workspace (`/finale/capstone/workspace`): **Build workflow**, where the learner designs Scout's workflow from scratch. The canvas starts empty, with no starter steps, and the learner adds each step from "Add a step" and connects them. A browser draft or saved diagram that is still the old untouched starter is treated as empty. The workflow is saved and checked on the server. The Python "Code and run" workspace (editor, in-browser Pyodide sandbox and hidden tests) has been removed, along with its `/project` API. The `project_work` table is kept, so files learners wrote there aren't lost, but nothing writes to it. The learner finishes the project with "Submit project" on the brief.

## Learner profile ("About you")

The profile starts from the learner's field, and the field decides what comes next (`lib/setup.ts`, packs in `lib/profiling/packs.ts`):
- **At work:** role, years in the field, the systems they use, and the first job they would hand to an agent. Each of the six fields has its own pack; a typed field is matched to the nearest pack when possible (see "Profiling backend" below), and otherwise gets the general roles and jobs plus up to two follow-up questions.
- **Students:** study level, subject and projects so far. Their goals turn to studies and careers.
- **Everyone:** goal, experience with AI agents, coding, what helps first, explanations, and comfort.

Each bank question can carry three rules:
- **`when`:** ask it only when this holds.
- **`infer`:** skip it when an earlier answer already says it (Python among the tools implies the coding answer).
- **`legacy`:** values no longer offered that stay valid in saved answers.

`questionsFor(answers)` gives the questions to ask now. `normalizeAnswers(answers)` walks the bank in order and keeps only answers that still apply: switching from Student to IT drops the study answers, and values that are not options are dropped. It runs in the browser before saving and in the server's `AnswersIn` validator, so every save path (profile, setup, import) stores clean answers and the planner never sees a stale branch. `profileLines()` lists the asked or implied answers for the planner prompt and summaries.

Two answers also drive the rule-based plan (`server/planner/baseline.ts`):
- **Coding:** lessons whose videos contain code (`codeLessons`, found from the content in `context.ts`) start on extra help for someone who has never coded, and on a light touch for someone who writes Python. A quick-check score for that lesson, or a level the learner chose, still wins.
- **Study level / years:** the summary names a student by study level, and a professional by years in the field.

"About you" is an **interview written by the language model** (`components/onboarding/interview-chat.tsx`, `server/profiling/interview.ts`, `POST /api/v1/profiling/turn`). There is no form and no fixed question list.

1. The learner types the field they work or study in; there are no field options.
2. That text is read once (`analyse.ts`): its nearest pack, or a student, with field-specific wording, roles and first jobs.
3. From then on, each turn the model writes the next question from the conversation so far: its wording, 2–6 answers to tap (always alongside "type your own answer"), and which fact to ask about next. It also writes a one-line reaction to the last answer, and reads a typed answer as one of the course's values ("I've played with ChatGPT a bit" → tried a little).

The facts it works through are the question engine's for this learner (`questionsFor`, plus comfort), so the server:
- only accepts a question about a fact that is still missing;
- only accepts option values the course understands (or, for role and first job, the model's own wording, stored as a typed answer with a role kind);
- never accepts a personal question;
- stores the transcript in `answers.interview` for the planner.

The profile interview asks only person-level facts (field, role, years, tools, coding, learning style, comfort); course facts are asked when enrolling (below). It ends when nothing is missing or after 9 questions. If the model is unavailable or its question fails the checks (the reason is logged as `[interview] question rejected: …`), the engine's own question for the next missing fact is asked. Every turn is saved as a draft; "Start again" discards it. A typed field never offers "Student".

**Two stages.** One profile can't tailor every course on a platform with many courses, so the interview is split:

- **Profile, after signing in** (`interviewTurn`, `/api/v1/profiling/turn`): who the learner is. Saved to `profiles`.
- **Course, when enrolling** (`courseTurn`, `POST /api/v1/courses/:courseId/fit`, the "This course" enroll step, `?step=fit`): four or five questions about this course only, written by the model from the course outline and the saved profile. It asks what they want from the course (`goal`), their experience with its topic, the first job they'd give an agent, which modules they already know (`known`, module ids), and what to focus on or skip (`expect`, their words). The transcript is kept in `answers.courseInterview`.

The course route is stateless: the profile is read from the server, the client sends only the course answers so far, and the reply carries only course answers (`coursePart`). They're stored with the enrolment when it is saved, never in the profile (`profilePart` on every profile save, client and server; `COURSE_KEYS` in `lib/setup.ts`). The planner reads them: a known module becomes `skim` with light help, unless the learner chose a help level or the quick check measured it; `expect` and the course transcript go to the AI planner.

**Model quota.** A Gemini free-tier key allows few requests a day on the larger flash model. A model whose quota runs out is skipped until it resets (`llm.ts`), so this project uses `gemini-3.5-flash-lite` first, with `gemini-3.5-flash` as the backup. One interview is about 11 model calls.

## Profiling backend

"About you" is saved as it is answered, and a field the learner types is analysed on the server (`server/profiling/`):

- `GET /api/v1/profiling`: where it stands, as answers, comfort needs, the derived result and the questions. That is the draft in progress, else the saved profile.
- `POST /api/v1/profiling/turn`: one interview turn. It stores the last answer (the typed field on the first turn), saves the draft (`profile_drafts` table) and returns the model's next question, or `done`.
- `POST /api/v1/profiling/next`: saves answers without asking anything (kept for other clients).
- `POST /api/v1/courses/:courseId/fit`: one turn of a course's enrolment questions (nothing stored; 404 for an unknown course).
- `DELETE /api/v1/profiling`: discards the draft ("start over"); a saved profile is kept.
- `PUT /api/v1/profile`: finishing. The draft becomes the profile, with its derived result in `profiles.derived`.

A typed field ("I run a dental clinic") is analysed once per text (`analyse.ts`):
1. A keyword match gives a first answer, and is all there is without a key.
2. With a key, the language model returns:
   - the nearest field pack with a confidence (a pack is used at 0.6 or above);
   - that field's own nouns for "In your world" examples;
   - when no pack fits: 3–5 **roles** people in that field hold and 3–4 **first jobs** an agent could take over, which replace the general lists, plus up to two follow-up questions. A typed field never offers "Student"; until the model answers (or if it can't), it gets a work-only general role list.

   The chat waits up to 12 s on the role question ("Looking at your field…") so these options appear. Results record the prompt version (`PROMPT_VERSION`), and results from older instructions are redone.
3. The reply is checked before use: its shape and lengths, no links or markup, and no questions about the person themselves (age, gender, health, religion, money, location, contact details). Anything unusable falls back to the keyword match, and a failed analysis is retried after a minute.
4. At most 12 analyses an hour per learner.

The result (`lib/profiling/derived.ts`) is shared with the browser's question engine:
- a matched pack is stored as the `field` answer, so that pack's questions follow;
- follow-ups are asked just before the goal, with their answers in `answers.extra`;
- the nouns feed `domainOf`, so the rule-based plan's examples use them;
- follow-up answers reach the AI planner's prompt.

The browser shows the next question at once from the rules, and AI results slot in further down when they arrive. The validator only checks the shape of answers; the services normalise them with the learner's derived result.

**The language model** (`server/ai/llm.ts`) is provider-neutral and set in `.env.local`: `LLM_PROVIDER` (`openai` for any OpenAI-compatible API, or `anthropic`), `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_FALLBACK_MODEL`, `LLM_REASONING`. This project uses Google Gemini through its OpenAI-compatible endpoint (`gemini-3.5-flash`, falling back to `gemini-3.5-flash-lite`), asked for low reasoning so short JSON replies stay fast. Without `LLM_API_KEY` the older `GLM_*` settings apply; without any key, everything runs on rules. `GET /api/v1/health` reports the provider and model.

## Adaptive lessons (problem hook → concept → worked example)

Each module's opening problem, concept videos and worked examples are rewritten for each learner as a **fully new scenario in their own world**, from their profile and their enrolment answers (`server/adapt/`). The teaching stays the same; the story, people, messages and examples move to a fictional organisation in the learner's field.

- **When.** Module 1 is rewritten right after enrolling (`saveSetup` → `adaptFirstModule`). Every other module is rewritten when the learner finishes the one before it (`recordProgress` → `adaptNextModule`) or first opens it (`GET …/modules/:moduleId/adapted`). If the profile or setup changes, the module is rewritten the next time it is asked for (`inputs` fingerprint).
- **Pieces, in the order they are met** (`pieces.ts`): `hook`, then `video:<id>` for each concept video, then `worked`. Each piece goes live on its own once both its text and its voice are ready, so the opening is personal within minutes while later videos follow. Until then, or if writing fails, the authored piece plays. A piece that becomes ready mid-topic waits until the topic is next opened (`useSteadyAdapted`), so a story never changes under the learner.
- **One world per learner.** The first piece written also invents the learner's "world": organisation, what it does, their role, customers, people and the trouble. It is stored as the `world` row, and every later piece and module reuses it. Each learner's rewrites run one at a time (`serial`), so two runs can never invent two worlds.
- **Shape-locked rewriting** (`write.ts`, `shape.ts`). The model gets the authored piece as JSON and returns the same JSON. It is merged key by key: ids, icons, kinds, scene types, cue indexes, numbers, diagram links and quiz answers stay authored. Lists keep their length, and texts stay near their authored length. Quizzes stay authored unless they name the authored story; those are reworded with the same correct answer. A piece is refused if any of the authored story is left (Orbit, its people, `ORB-` numbers). Pieces that don't fit get one repair round, then fall back to the next model.
- **Voice** (`tts.ts`). Narration is spoken by **Gemini text-to-speech** (`AUDIO_PROVIDER=gemini`, its own key in `AUDIO_API_KEY`, model `AUDIO_MODEL`, default `gemini-3.8-flash-lite-tts`, voice `AUDIO_VOICE`, default `Charon`, narrator style `AUDIO_STYLE`). It uses the Interactions API, one request per clip, four at a time, so a module is voiced in minutes. An overloaded API is retried. When the quota runs out, the model is skipped until it resets, and **Kokoro** speaks the whole piece instead, so a piece never mixes two voices. Kokoro (`kokoro-js`, Kokoro-82M ONNX) also speaks when no audio key is set. It runs in a separate worker process (`scripts/tts-worker.mjs`), one job at a time, fp32 on the CPU by default (about 4.4× real time on an i5-14400; `KOKORO_DEVICE` / `KOKORO_DTYPE` pick another device, and a GPU that fails falls back to the CPU). Clips are 24 kHz 16-bit WAV under `.data/adapted-audio/<enrollment>/<module>/<piece>/`, served with byte ranges only to their learner by `/api/v1/adapted-audio/…`. Hook clips are `open`, `s<i>`, `s<i>-then` and `r<k>`, and video clips are `s<i>`, matching the authored MP3 names. `AUDIO=off` skips voicing (captions only) and `KOKORO=off` leaves Kokoro out.
- **Storage.** The `adapted_content` table (migration `0005`) holds one row per enrollment, module and piece: status `writing` → `voicing` → `ready`, or `failed`, plus the content, the clip urls, the model and any error. A piece interrupted by a restart is redone, and a failed piece is retried after 3 minutes.
- **In the player.** `useAdaptedModule` fetches the ready pieces and polls while some are still being written, and `withAdapted` swaps them into the module. The hook's scenes show the learner's organisation (`HookBlock.brand`). The adaptation strip says "Set at <organisation>", or "Being rewritten for you" while the authored version plays. "In your world" cards now show the planner's per-lesson `inYourWorld` text, falling back to the field template.
- **Not adapted:** guided practice, scenarios, the module check, the capstone and the final assessment. These stay authored, and assessment never adapts. The agent the learner builds is still called Scout throughout.
- **Without an LLM key** nothing is rewritten. The tests (`node tests/backend/run.mjs adapt`) use stand-ins for the model and the voice.

## Course companion

`app/(app)/learn/layout.tsx` builds a teaching-only passage index on the server. `lib/companion.ts` excludes assessment questions, answer keys, and scenario solutions. The client provider selects the current course from the route and registers transient step context from video slides, worked examples, guided checkpoints, and scenarios. Unmounting a registered context releases it.

Pip answers through `POST /api/v1/courses/:courseId/companion` (`server/companion/service.ts`), using GLM via the client shared with the planner (`server/glm.ts`). The browser sends the question, the current phase/module/step, and the last 8 chat turns. The server keeps Pip in scope in layers, cheapest first:

1. **No model call.** Assessment phases (`gate`, `final-check`, `precheck`) and the quick buttons ("Next step", "Hint") are answered from authored guidance (`quickReply`). Both the browser and the server decide this.
2. **Pasted check questions.** A message that contains most of the words of a module-check or final-check stem is refused before the model sees it (`matchesAssessment`). Quick-check stems are not guarded: they ask the course's core ideas plainly, which learners should be able to ask once the lessons start.
3. **Course-only context.** The system message holds Pip's rules and a compact course outline (module labels, lessons, skills). It is identical for every learner, so the provider can cache it. The user turn holds where the learner is, up to 6 teaching passages ranked for the question (`relatedPassages`; the slide on screen always comes first), and the question. The rules decline off-topic requests in one sentence, never answer assessment items, give hints rather than solutions for practice and the mini-project, and treat learner text as questions, never instructions.
4. **Reply checks.** The model replies in JSON with `reply`, `scope` and the number of the passage it used, which becomes the source link. Markdown and links are stripped, and an out-of-range source is dropped.

Without `GLM_API_KEY`, when the key is rejected, or when both models are busy (20 s timeout each), Pip falls back to the extractive answer: the best-matching authored passage with its link. If the request fails, the browser does the same locally, so Pip always answers. Each learner gets 20 model-backed messages per 5 minutes; the limit is held in memory per server process. Chat is held in memory; course notes persist locally.

Prechecks, module gates, and the final assessment allow process guidance only. The chat history and notebook are hidden there, and the server applies the same boundary. The phase is reported by the browser, so this is a learning aid, not a secure exam environment; the pasted-question guard and the model rules cover a learner who misreports it.

## Adaptation and persistence

`learning-rules.ts` contains pure guidance and review-scheduling functions. Starting support comes from the existing profile/precheck. Recent practice can add or reduce scaffolding; an explicit module preference or existing enrollment override takes precedence. Three independent successes can lighten guidance; two recent failures request extra guidance. Final assessment difficulty is unchanged. Responses after feedback and checklist-only confirmations do not count as independent success.

New state is separate from the existing stores:

- `lms-learning:v1:{courseId}` (schema V2): support choices, bounded practice evidence, reflections, notebook, review schedule, meaningful activity days, and the last visited lesson URL.
- `lms-video-position:v1:{courseId}:{videoId}`: slide, playback/check phase, completed checks, and seen slides. Videos resume paused at the saved slide.
- `lms-prediction:v1:{courseId}:{moduleId}`: initial hook prediction, revisited during reflection.
- `lms-decisions:v1:{courseId}:{stepId}`: scenario decisions.
- `lms-roleplay:v1:{courseId}:{stepId}:{missionId}`: roleplay scene, committed decisions, Goal/Trust/Safety signals, hint use, and completion.
- `lms-gate:v1:{courseId}:{checkId}`: a local copy of the graded outcome for review. It does not replace backend progress. Demo module and finale access remains open; persisted stage identifiers, server-plan order and completion records are preserved. A passed quiz exposes the reflection UI, while the course keeps its existing completion semantics.

Review tickets start at 3, 10, and 30 days. Scheduling is idempotent. A difficult review can return tomorrow. Early successful practice leaves the future ticket scheduled. The course page and Reviews page display these tickets. No background notifications or server scheduler were introduced.

## Focused module delivery

The player uses a viewport-sized `StageShell` on desktop. Its topic header and action footer remain visible while only the current activity pane scrolls. The adaptive control bar stays compact and exposes the current support behaviour plus the learner override. Guided missions and scenarios use two panes so the brief or evidence remains beside the action. Mobile returns to a natural single-column document.

The activity unit is deliberately small: one video slide, worked-example frame, guided waypoint, scenario case, or quiz question at a time. Module quizzes keep all responses in memory while the learner moves through a numbered question navigator. Scenario support uses the same computed support level as guided practice: extra support reveals the first hint and opens evidence, balanced support offers hints after a try, and light support starts with evidence collapsed. This changes scaffolding and presentation only; assessment questions and pass thresholds remain fixed.

The concept experiments (the Lesson/Experiment toggle, the dock's "Try the lab" and the course page's "Try an experiment") have been removed; concept topics are the narrated videos with their quick checks.

## Validation

Run from the repository root:

```text
node node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.json
node --test apps/web/tests/learning-experience.test.cjs
node fixtures/scripts/build-ai-agent.mjs --check
npm run build
```

The focused tests cover adaptation, isolated persistence, review timing, scoped retrieval, assessment boundaries, course sequencing, and React server rendering of the new journey. Browser interaction checks are still required before release. The authoring validator currently reports nine existing missing-simulator warnings for module 5.

Pip now receives the active video ID and slide title. Retrieval requires a match in the teaching text itself, ranks exact authored definitions and individual key ideas above narrative introductions, and uses lesson context to break ties. Generic “explain this” requests use the current step. Assessment boundaries remain unchanged.

## Gamification

`lib/gamification.ts` derives the game layer from existing evidence instead of maintaining a second completion system. Completed stages, watched videos, unique practice attempts, reflections, spaced reviews, and finale steps produce XP. Repeating the same saved action cannot farm XP. Hints never reduce XP or mastery stars. Levels, Sparks, badges, Scout upgrades, module mastery stars, and the daily mission are all deterministic views of the same course progress.

Learning state is now schema version 2 and adds a bounded list of meaningful activity days. Version 1 data migrates in memory, reconstructing available activity from attempts and completed reviews, and is written as version 2 on the next learning action. The existing `lms-learning:v1:{courseId}` storage identifier remains stable so current browser data is not abandoned. Stage, video, and finale completions record activity; reviews already record it through practice evidence. Streaks allow the current day plus one recovery day.
# Focus session state

The course-player focus sprint uses the course-scoped localStorage key `lms-focus:v1:<courseId>`. Its small state contains the selected duration, seconds remaining when paused, and an absolute `runningSince` timestamp while active. An absolute timestamp keeps the countdown accurate across route changes and background throttling. It is intentionally separate from learning evidence and gamification state: starting or finishing a timer never grants mastery or XP.

The wide learning dock communicates with existing course surfaces through browser events. `pip:notes` opens Pip directly on the notebook tab when assessment rules allow it. Assessment restrictions remain enforced by the companion itself.

My notes PDF export uses an isolated, temporary print iframe (src/lib/notes-pdf.ts). User text is HTML-escaped before rendering, and native browser printing handles Unicode and pagination. No API, network, or persisted-state changes are needed; the user selects Save as PDF in the print dialog. The iframe is removed after printing, with a timeout cleanup fallback.
