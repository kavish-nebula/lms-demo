# Profile-driven prerequisites and activity

Implemented on 17 October 2026. This supersedes the older enrollment descriptions in README/HANDOFF for the prerequisite preview, prior-knowledge check and Google-connected course planning.

## Learner experience

1. About you collects the learner's field, experience, sub-role, desired task and goal.
2. A generated prerequisite video explains the foundations through their own work. Its 4–5 scenes contain matching narration, short captions, generated photographs and model-selected comparison, reveal or sequence animations. Playback supports continuous narration, manual scene navigation, transcripts, native audio controls and reduced motion.
3. A generated activity replaces the prior-knowledge quiz. New tasks ask the learner to draft or repair instructions or assemble a workflow from supplied fictional working material. The model evaluates the actual artifact and chooses each next task from the uncertainty it reveals. The activity has 3–5 tasks. It records observations, demonstrated or emerging skills, uncertainty, support recommendations, confidence and help use. It does not manufacture quiz scores or assume competence from occupation.
4. The learner sees the observations and can adjust their preferred order. A model generates the full course plan from the profile, verified transcript and observations. The saved plan supplies examples, module emphasis, topic order, pacing and lesson support. Final assessment requirements are unchanged.

A doctor's examples concern clinic appointment administration and message routing. An SRE's examples concern alerts, read-only telemetry and incident summaries. The difference is generated from the full profile; it is not a job-title substitution in fixed slides.

## Google Cloud setup

The local preview uses project `nebula-lms`, global Vertex AI, and existing Application Default Credentials. The Vertex AI API was enabled and a real request verified. No credential or access token is stored in source files.

From the repository root:

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env.local
# If ADC is not already configured on this machine:
gcloud auth application-default login
gcloud auth application-default set-quota-project nebula-lms
npm run dev
```

On GCP, use the attached workload service account with Vertex AI access instead of developer credentials. The application also supports a Gemini API key when `GOOGLE_CLOUD_PROJECT` is unset.

Open `/learn/courses/ai-agent/enroll`. `?step=intro` previews the personalised prerequisites; `?step=precheck` resumes the generated activity. These existing route names are retained for compatibility. `/api/v1/health` reports the configured model and project without exposing credentials.

The Windows sandbox used for development prohibits filesystem junctions. Validation therefore used Webpack, with a shared Tailwind PostCSS configuration that also supports normal Turbopack operation:

```powershell
npm run dev --workspace=apps/web -- --webpack --port 3001
npm run build --workspace=apps/web -- --webpack
```

For a sandbox that also restricts concurrent directory creation, the verified serial production-build command is:

```powershell
$env:LMS_SERIAL_BUILD='true'
$env:UV_THREADPOOL_SIZE='1'
npm run build --workspace=apps/web -- --webpack
```

`LMS_SERIAL_BUILD` only changes build concurrency when explicitly set; normal installations retain Next.js defaults.

## Models and cost controls

Defaults are configurable in `.env.example`:

| Job | Default |
| --- | --- |
| Story, adaptive task design, evaluation, course plan | Gemini 3.8 Flash |
| Profile questions and narration transcript checking | Gemini 3.1 Flash-Lite |
| Scene photographs | Gemini 3.1 Flash-Lite Image |
| Narration | Gemini 3.8 Flash-Lite TTS |

These choices favour the Flash family for quality, latency and cost. As of 17 October 2026, Google's published global introductory price for Gemini 3.8 Flash is $0.75 input / $3.75 output per million tokens through 31 December 2026. Flash-Lite Image lists $0.034 for a 1K output image. Flash-Lite TTS lists $0.50 text input / $6 audio output per million tokens during the same introductory period. Prices and model availability can change: see [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) and [Flash-Lite TTS](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash-lite-tts).

Illustrations and speech generate on demand and are cached by content, model and owner. Replaying cached media causes no new model generation. A full preparation uses at most five preview images and five task images: at the listed image rate, up to $0.34 for those images, plus text and speech usage. Animation renders in the browser from the model's storyboard. Session and plan retries reuse saved results; in-flight starts, turns and media are deduplicated. Course revisions have a ten-minute resource cooldown. This bounds routine work but is not a billing-account spending limit.

## Architecture and decision boundary

- `server/ai/google-transport.ts` sends authenticated server-side requests to Vertex AI, or the Gemini API when configured that way. Tokens stay server-side.
- `server/adaptive-onboarding.ts` generates and persists preparations, evaluates activity turns, checks course references, generates plans and caches media.
- `lib/adaptive-onboarding.ts` defines the validated data contracts. Generated content is data rather than executable HTML or code.
- `components/enroll/adaptive-preparation.tsx` renders the generated video and accessible artifact-building activity.
- `/api/v1/onboarding`, `/turn` and `/media` check session ownership. The private evaluation guide and full transcript are not returned to the browser.
- An `assessmentId` joins the server-held transcript to enrollment. Client-supplied evidence or levels cannot replace the verified assessment. A changed profile requires a matching activity.
- `server/planner/service.ts` stores a model-authored plan directly for Google-connected enrollments. Lesson playback uses that plan's support choices rather than the local recommendation rules. New evidence goes back to a model for revisions.
- Schema, real course IDs, valid permutations, bounded payloads, ownership and idempotency are ordinary software checks. They validate the output and protect saved work; they do not select pedagogical support or infer mastery.
- Failures offer retry or preserve the last valid model plan. The new flow does not silently substitute the static quiz, fixed story, keyword grader or rule-based plan.

The old GLM/offline demo functions remain for historical installations and regression tests. They are not the decision path for the configured Google flow or enrollments carrying the new assessment ID.

## Persistence and current boundaries

Profiles, enrollments and plans use the existing PGlite/PostgreSQL backend. Preparation transcripts and media use a private persistent directory, `apps/web/.data/adaptive-onboarding` by default; `ADAPTIVE_ONBOARDING_DIR` selects another volume. Sessions expire after seven days. Browser drafts are saved under `lms-adaptive-draft:*`. Settings reset removes the learner's new sessions and owner-prefixed media along with existing data.

This is a local demo implementation. The existing shared demo identity remains. A multi-instance deployment needs shared durable storage for preparation artifacts and distributed locking for in-flight generation; a public multi-user deployment also needs the real authentication already noted in the project README. No site was deployed by this change.

## Validation

Run from the root:

```powershell
npm run lint
npm run typecheck
npm run build --workspace=apps/web -- --webpack
node fixtures/scripts/build-ai-agent.mjs --check
node fixtures/scripts/check-project.mjs
node --test apps/web/tests/learning-experience.test.cjs
```

Run from `apps/web`:

```powershell
node tests/backend/run.mjs adaptive
node tests/backend/run.mjs
node tests/backend/run.mjs engagement
node tests/backend/run.mjs workflow
```

The isolated adaptive suite verifies ownership, refresh persistence, generated task context, retry idempotency, real course references, preservation of model decisions, media caching/MIME types, verified assessment enrollment, and reset. It uses model fixtures and makes no cloud calls.

Live Vertex checks used fictional doctor and SRE profiles, generated text, image and WAV audio, a five-turn clinic activity, and a complete saved course plan. The doctor test showed prompt-structure and tool-cycle gaps; the saved model plan assigned extra help to modules 2 and 3 while retaining standard help elsewhere and generating clinic examples for every lesson.

Final checks passed: production compilation and prerendering with the serial Webpack command, TypeScript, ESLint (zero errors; five existing unused-variable warnings), 39 learning-experience tests, and the backend, engagement, workflow and new adaptive-onboarding suites. Course authoring validation has zero errors and the nine previously documented module-5 simulator warnings. The Python starter fails as intended; the reference solution passes 66/66 hidden checks and 22/22 sample checks.

## Synchronized profiling companion

Choose **Start with Pip** once to allow browser audio. Pip reads the question, waits for an option or a typed answer, speaks a contextual acknowledgement, and only then shows and reads the next question. Choices are disabled during narration and generation. The last acknowledgement finishes before Continue becomes available.

Pause/resume, replay, Back and Read instead are explicit learner controls. Back cancels active speech and discards late responses from the previous branch. Double clicks are locked synchronously. Cloud voice uses the configured Vertex TTS chain; if it fails, the device voice reads the same text. Playback failures offer retry or reading mode. Browser autoplay restrictions show **Hear Pip**. No duration estimate or timer advances a spoken step.

`lib/profile-conversation.ts` owns the sequence. `lib/profile-voice.ts` resolves a line only at its actual playback end. `/api/v1/profiling/conversation` creates the reply and next question; `/api/v1/profiling/voice` serves only registered, owner-bound lines. Speech recordings are cached privately under `.data/profile-voice` and removed by Settings reset. Question audio is prepared while the reply plays, reducing delay and repeat model calls.

The Continue action passes the complete answer snapshot directly to enrollment, waits for profile saving, and prefetches the prerequisites with that same snapshot. The final goal is included. Editing a profile replaces the player and invalidates its old pending requests. The existing fingerprint includes field, experience, role, task and goal, so changing these creates new slides, narration, images and activities.

Additional checks, run from `apps/web`:

```powershell
node tests/backend/run.mjs profiling
```

This suite exercises question/reply completion ordering, answer locking, duplicate clicks, the final answer snapshot, Back cancellation, retries, pause/resume, browser audio permission recovery, device speech fallback, reading mode, and voice ownership/cache/reset. The adaptive suite also verifies that a changed final goal creates a distinct prerequisite session and sends the complete profile to its model.

Live follow-up verification completed in the local app on port 3001: question replay and pause kept choices disabled; the final cloud-spoken reply kept Continue unavailable until playback ended. The completed doctor profile saved the goal “Create an agent for my clinic”. Its new prerequisite session produced “Automating Outpatient Scheduling Safely”, four clinic-specific scenes, a valid generated JPEG and playable WAV narration, with a different session ID from the earlier profile. Production build, TypeScript, ESLint (zero errors and five existing warnings), all 39 learning-experience tests, profiling, adaptive-onboarding and the backend regression suite passed for this update.

## Generic learner contexts and compact activities

The profile now begins with school, college/university, teacher/staff, workplace or independent learning, followed by subject/field, experience, current role/study, application and learning outcome. `learningContext` and `learningContextDetail` are optional profile JSON fields, so historical profiles remain readable. Goals are model-written outcomes for current studies, life or work; the previous forced job-search/career categories are removed. Historical goal tags remain readable without adding them to new options. Connected question-generation failures offer retry rather than substituting unrelated profession choices.

The initial companion card shows “Pip · Your learning companion” and Start with Pip, without describing its workflow. The activity has one short scenario, essential facts and one response surface. Ordering cards start together in a shuffled list with accessible move controls. Compose tasks have one draft field. Media, optional notes, confidence and help-use are disclosed on request. Unanswered reflection is recorded as `confidence: not-stated`, `helpUsed: null`; it is never invented or converted into a score. Identical submission retries reuse their submission ID.

New model outputs are validated with `CompactActivityTask`: scenario ≤180 characters, instruction ≤160, essential facts ≤500, and each action ≤90. The prompt targets roughly 25 / 20 / 60 / 10 words respectively and stores detailed assessment criteria privately. Legacy task shapes remain readable. A new generation-cache version replaces old verbose preparation for new sessions while allowing unchanged historical completed assessments to be used. Profile context is included in cache identity.

The course-planning model receives the complete verified transcript: actual drafts, chosen orders, optional notes/reflection and skips. It selects support, depth, practice emphasis and contextual examples for every module and lesson, while leaving untested skills explicitly uncertain. Context does not determine ability and there are no fixed adaptation scores or learner-type rules.

Validation for this update: production build and TypeScript passed; ESLint has zero errors and the five existing warnings; 42 learning/interface tests passed, alongside profiling and adaptive backend suites. Live Vertex generation produced current-context goals and compact school/company tasks of approximately 75 and 81 words. School and workplace profiles create distinct preparation sessions.

Visual follow-up: source facts are available under the closed “Task details” disclosure, so the initial screen focuses on the scenario, instruction and response. Detailed facts are still available to every learner without marking them as having requested a hint.


## Interactive mission and HTML prerequisites (October 17)

New preparation uses a narrated HTML slide deck (titles, captions and accessible diagrams), without a generated photo/video dependency. Each slide's actual audio playback drives its optional reveal; slides advance only after narration ends or the learner chooses Next. Transcript, replay, manual navigation and reduced motion remain available.

The starting assessment is one continuous fictional mission in an animated inbox → agent workflow → outcome workspace. Learners add/remove/reorder action cards, optionally configure agent instructions, and run their workflow. There are no standalone quiz questions or visible task counters. The model simulates consequences and continues the SAME mission with a new event or repair opportunity for 2–4 runs. Unchanged action IDs and the learner's actual configuration carry forward for revision. The UI animates execution while waiting; it never grades, decides consequences or calls real-world tools.

Generation validates stable mission identity, real lesson IDs, bounded action traces and unique selected IDs. Full configuration, edit/run events, scenario facts and consequences reach the model's evidence assessment and whole-course planner. UI speed and editing counts are not knowledge scores. No unreported reflection is invented. Drafts and idempotent run IDs survive retry; failed generation leaves the last saved state intact.

Cache generation version: adaptive-onboarding-3-scenario-studio. Saved older completed assessments remain accepted with unchanged profiles. Legacy tasks remain readable, while newly generated tasks require the simulation workspace schema. A new profile/session requests the updated format automatically. Run adaptive backend and learning-experience tests, then a production build. Live GCP checks should use mock profiles without overwriting the learner's profile.
