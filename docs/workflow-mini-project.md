# Workflow mini project

The AI Agent capstone now offers **Workflow project** alongside the existing **Python project**. Open it from the project brief or Python workspace at `/learn/courses/ai-agent/finale/capstone/diagram`.

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
