# Adaptive LMS and backend merge

On 2026-10-13, `demo/feature/adaptive-lms-experience` (`ee480c7`) was merged into `ai-agent-backend`. The user explicitly chose to preserve the backend and both mini projects. The source branch had removed those implementations, so its browser-local architecture was not adopted.

## Integrated experience

The merge includes the course journey, contextual Pip companion, six experiment labs, adaptive practice guidance, guided simulations and solved cases, focused lesson workspace, playback recovery, scenario decisions, reflection notes, scheduled reviews and review/history/credential routes. Teaching content additions from the adaptive branch remain available. Pip indexes authored teaching material, excludes assessment solutions, and restricts help during prechecks, module checks and the final check.

## Preserved data and behavior

Enrollment, profile, course progress, server-written plan history, assessment/planner signals, Python files and grading remain backend-backed. The workflow diagram project and engagement storage/APIs remain independent. Existing migrations, dependency versions, project fixtures, generator, session identity and saved progress keys are retained. Browser-local support choices, practice evidence, reflections, review tickets and playback checkpoints supplement that data rather than replacing it.

The player reads the existing server plan's topic order, writes stage completion through the original progress hook, and sends module/scenario/recall evidence through the planner signal path. Local practice also informs the new guidance UI. Final assessment behavior remains independent of that guidance. Demo access stays open on course navigation and direct module URLs; the source branch's quiz-based access restrictions were not enabled. Tests that previously passed a browser-only gate map as the fifth `deriveProgress` argument now exercise the retained backend-plan contract and demo access instead.

The capstone keeps both **Python project** and **Workflow project** links. Diagram checks do not replace Python grading or capstone completion. Platform activity points, weekly goals and streaks still use the server reward ledger and activation baseline. Course practice XP is a separate course presentation and does not submit platform reward totals.

The companion and practice stores stay browser-local and are removed by reset's existing `lms-` cleanup. The shared demo identity is retained; genuine public multi-user deployment still requires authentication.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm run build`, `node fixtures/scripts/build-ai-agent.mjs --check`, and `node --test apps/web/tests/learning-experience.test.cjs` at the root. Run `node tests/backend/run.mjs`, `node tests/backend/run.mjs engagement`, and `node tests/backend/run.mjs workflow` from `apps/web`.

The merge is validated against the adaptive pure/UI suite and the existing backend, engagement and workflow suites. Browser regression checks use a separate preview, leaving the running port-3001 server and existing Python work intact.

Validation completed: lint, typecheck and production build pass; all 31 adaptive tests and the backend, engagement and workflow suites pass. Course authoring validation reports zero errors and nine existing module-5 warnings for manual steps without simulator metadata. Browser checks confirmed server-plan example-first ordering, the experiment workspace, direct module-2 access in demo mode, Python editor readiness, retained saved workflow revision/report, and disabled notebook/course hints during the final assessment.


## Adaptive platform integration (2026-10-19)

Merged feature/adaptive-platform into lms-demo's feature/ai-agent-backend. The merge starts from the published backend branch, separately from feature/ai-agent-course.

The incoming adaptive preparation (narrated examples and scenario activities), verified assessment artifacts, Gemini/Vertex transports, provider fallback chains, local voice service, module-one content, and agent blueprint/progress surfaces are integrated with the backend's enrollment, profile, migrations, progress keys, scoped companion and lesson rewriting.

General profiling still runs after login. Course enrollment begins with the course-only interview, followed by adaptive preparation, activity, customization and build. Course answers remain enrollment-scoped. Both the old profiling GET/DELETE API and the incoming slot-question POST API are retained. Normalization preserves the incoming context, task, agent-name and tag fields without discarding the legacy branching answers.

The full-height My Assistant panel and automatic guidance remain. Removed pricing, experiment labs and Python-project interfaces are not restored. The workflow project stays available. Native audio assets remain paired with authored narration; personalized versions use generated clips.

Tests retain both profiling suites (profiling and adaptive-profiling), both learning-experience suites, and add the incoming adaptive backend suite. Backend test runners use fileURLToPath for Windows paths and clear provider credentials in test processes.

The Kokoro companion worker uses a hidden Node spawn with IPC and app-root resolution, matching the backend worker pattern and avoiding Turbopack attempting to bundle the worker entrypoint. Both worker scripts are explicitly included in production tracing.

For zero-network demos with no Google provider configured, enrollment goes directly from course questions to customization/build. Configured deployments enable the incoming narrated preparation and scenario activity. No credentials are copied into the merge checkout.

Validation: production build and typecheck pass; 43 learning-experience tests pass; all ten backend suites pass. The adaptive profile regression checks verify that context, use-case, agent name and deduplicated tags survive validation/normalization. Production build currently reports three non-fatal Turbopack tracing warnings for runtime-generated media files.
