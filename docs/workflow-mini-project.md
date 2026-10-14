# Workflow mini project

The AI Agent capstone mini-project combines **Code and run** with **Build workflow** tabs in one workspace. The Python editor includes `prompt_engine.py` and the read-only `docs/policy.md`; sample emails and tests run in the browser Python sandbox. The workflow tab opens the learner’s saved Scout diagram, where learners can edit, save and check the connected architecture. The standalone `/learn/courses/ai-agent/finale/capstone/diagram` route remains available and opens the same workflow builder.

The sandbox uses Pyodide 0.29.5 from the npm dependency and serves the runtime assets from `/pyodide/`. `predev`, `prebuild` and `prestart` copy only the required runtime files into the ignored public asset directory. This keeps first-run Python startup independent of a third-party CDN; the sandbox remains isolated in its scripts-only iframe and worker. The local asset route permits cross-origin worker loading only for these public runtime files.

Learners arrange and connect seven step types: receive request, safety check, classify intent, order lookup, decision, reply and human handoff. Starter steps are unconnected. Steps have editable names and notes; connections have explicit branches. Dragging is optional: select controls and buttons support connecting, editing, removal and Undo. Focused canvas steps can be moved with arrow keys. JSON export retains the full diagram.

Architecture checks verify reachability, required branches, safety before tools, classification before lookup, lookup before decisions and replies, and termination without cycles. Three scenario traces follow the connections for found orders, missing orders and unsafe requests. These are structural practice checks, not execution of an AI model or proof that the Python program works.

## Persistence and compatibility

Migration `0003_wealthy_oracle.sql` adds `workflow_projects`, one independent record per enrollment with a version-1 diagram, last check report and revision. It uses the existing session user and cascades when an enrollment or learner is reset. Existing Python files and reports remain in `project_work`; no fixture, progress identifier or existing grading behavior changes. Diagram checks do not mark the capstone complete or send adaptation/reward events.

`GET/PUT /api/v1/enrollments/[courseId]/workflow-project` reads/saves a diagram; `POST .../workflow-project/check` saves and computes a report server-side. Strict schemas reject unknown fields, duplicate IDs, nonexistent endpoints, repeated branch outputs and oversized input. Limits: 40 steps, 80 connections, names of 100 characters and notes of 500. Saves lock the enrollment and require the expected revision; stale concurrent requests receive HTTP 409.

Edits retain a browser draft under `lms-workflow:v1:{courseId}`. Server save is explicit. Unsaved drafts survive reload and failed saves; a conflict offers a confirmed load of the latest server copy, with export before replacing the local draft. Reset's existing `lms-` cleanup removes drafts. Preview learners can edit and check locally; enrollment is required for server persistence. The existing shared demo identity remains in use.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm run build`, and from `apps/web`, `node tests/backend/run.mjs` and `node tests/backend/run.mjs workflow`.

The targeted suite verifies correct and incorrect paths, safety bypass, missing branches, cycles, step ordering, schema limits, persistence, concurrent revisions, session ownership, reset cascade, unchanged Python files and absence of progress/adaptation writes. Browser testing uses the separate persistent test preview on port 3002; it leaves the port-3001 server holding the learner's existing Python work running.

The canvas uses the already-installed React Flow library and existing theme tokens. Interaction and accessibility behavior follow the official [React Flow interaction](https://reactflow.dev/learn/concepts/adding-interactivity) and [accessibility](https://reactflow.dev/learn/advanced-use/accessibility) documentation.
