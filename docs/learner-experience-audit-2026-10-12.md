# Nebula KnowLab learner experience audit and feature plan

Reviewed 12 October 2026. The current application is the Next.js app in `apps/web`, teaching **Build Your First AI Agent**. Its strongest asset is the learning sequence: encounter a problem, see an example, learn the idea, build, apply, check and revisit. The next investment should make that sequence dependable and easy to resume before expanding the catalog or adding social features.

## Scope and evidence

The local application was opened at http://localhost:3000. The review used the existing demo learner, browser interaction, screenshots at 390 × 844 and 1440 × 900, and supporting source inspection. Existing profile, enrollment, project files and completion records were preserved. One unsubmitted assessment answer was entered to check continuity; a tutor suggestion and the project's sample runner were exercised. No assessment was submitted and no credential was issued.

**Observed** means reproduced in the browser. **Source confirmed** means the behavior is present in the implementation but its failure path was not induced. **Opportunity** means a proposed improvement, not a defect. Priorities: **P1** affects trust, learning continuity or reliable completion; **P2** creates friction; **P3** is polish. This is a feature-level audit, not proof that every question, narration clip or browser combination works.

Seven learning platforms were researched through their public official pages: Coursera, Udemy, Khan Academy, Codecademy, DataCamp, edX and Duolingo. This represents different learning models; it is not a claim to have visited every learning platform or tested their paid learner accounts.

## Features reviewed

| Area | Coverage | Learner assessment |
| --- | --- | --- |
| Marketing and sign-in | Home, pricing, method, footer and sign-in inspected; demo entry used; auth implementation read | Clear method, but production promises exceed demo behavior |
| Catalog and course details | Course outline, outcomes, tools, reviews and setup inspected | Useful curriculum detail; lengthy before reaching the lesson |
| Personalization | Customise, profile and quick-check entry/question inspected; enrollment build and preview implementation read | Meaningful control, but contradictory guidance and too much setup detail |
| Dashboard | Resume, metrics, course card and module carousel inspected | Strong resume CTA; time and topic counts lack a consistent meaning |
| Opening story | Module 1 opening launched; entry, sound and skip controls inspected | Distinctive introduction; full film and verdict not completed |
| Concept lessons | Module 1 playback and transcript exercised; Module 6 lesson inspected | Captions, transcript, chapters and playback controls are valuable existing features |
| Worked examples | Modules 1 and 2 inspected | Prediction before a run is useful; example selector labels are unclear |
| Guided practice | Modules 1, 3 and 5 inspected | Concrete instructions and expected outputs; external setup remains a barrier |
| Scenarios | Modules 1 and 4 inspected; hint shown | Authentic decisions with evidence and progressive hints |
| Module assessment | Started, one answer selected, navigated away and returned | Clear rules; unfinished work is lost |
| Recall | Module 1 review inspected; scheduling implementation traced | Future recall content appears all at once; due-review data remains fixture-based |
| Tutor | Opened; suggested question submitted | Course scope disclosed; suggested question failed to match this course |
| Plan | Calendar, day picker, outline and session controls inspected | Planner differs from delivery order, timing and lesson granularity |
| Capstone | Brief and workspace opened; sample run completed | Good expected/actual comparisons and execution traces |
| Final and wrap-up | Final started without answering; reflection and finish controls inspected | Demo completion rules contradict mastery copy |
| Credential | Generated URL inspected in source and visited | Verification URL returns 404 |
| Settings and navigation | Language, appearance, accessibility, privacy and reset UI inspected; search exercised | Useful display controls; unavailable services look active |

Fresh enrollment was not replayed from an empty account, to preserve existing data. Save failures, offline startup, reminder delivery, real authentication, reset, full assessment grading and screen-reader behavior were not exercised. These require separate acceptance testing.

## Issues to fix

| ID | Priority and evidence | Learner issue and reproduction | Recommended correction |
| --- | --- | --- | --- |
| 1 | P1 · Observed and source confirmed | Sign-in says an email link will be sent and offers company SSO, but both implementations navigate to the same demo learner. | Clearly label demo entry and unavailable authentication. Add real identity and account isolation before production. |
| 2 | P1 · Observed | In M1 Tutor, click “Why does age + 1 fail when age is \"25\"?” The response says it cannot find that in the course. Other suggestions are generic Python questions. | Author suggestions per module and verify every suggestion has a useful answer. |
| 3 | P1 · Observed | Start the module check, select Q1, leave and return. The check returns to its intro and the response is gone. | Save an attempt draft and offer Resume or Start again. Add a leave warning when saving fails. Persist final-check drafts too. |
| 4 | P1 · Observed and source confirmed | Review shows Day 3, Day 10 and Day 30 questions together immediately. Dashboard and calendar receive `learner.due_reviews` from fixtures. | Separate an immediate recap from scheduled recall. Create real due items after module completion and open only the due review. Allow voluntary extra practice separately. |
| 5 | P1 · Observed | Player follows the learner's “example first” choice; planner marks the concept topic as next. Planner gives guided practice 15 minutes where the player gives 24, and scenarios 29 where the player gives 10. | Use one delivery manifest for player, course outline, resume and plan, including actual durations and lesson IDs. |
| 6 | P1 · Observed and source confirmed | Planner defaults to 7 October 2026 although the review date is 12 October. `FIXTURE_TODAY` is hardcoded. | Use the learner's current local date outside an explicitly labeled fixture mode. Keep date-only calendar values distinct from timestamps. |
| 7 | P1 · Observed | Visit `/verify/ai-agent`: 404. Credential UI calls the result verifiable and constructs this link. | Until verification exists, label credentials as demo samples. Production needs a credential-specific public record, issuer, requirements and revocation state. |
| 8 | P1 · Observed and source confirmed | Wrap-up says “Pass the final check” but enables “Finish the course” with empty reflection and no final result. Demo bypass is intentional. | Preserve open demo exploration, but distinguish demo completion from earned mastery and credential eligibility. |
| 9 | P1 · Source confirmed | Reminder toggle only saves a local preference; no reminder service is connected. Voice action leads to a coming-soon toast. | Label these services unavailable and avoid consent prompts for a service that does not run. When implemented, expose delivery schedule and revocation controls. |
| 10 | P1 · Source confirmed | Workspace ignores the project-load error returned by `useProjectWork`; after loading ends it can initialize starter files and enable saving. | Show a blocking load error with Retry. Never autosave a starter over existing work after a failed fetch; retain a recoverable local copy. |
| 11 | P1 · Source confirmed | Progress POST errors are swallowed and followed by a refresh. The learner receives no save failure explanation. | Keep a pending progress event, visibly show sync status, retry safely, and confirm completion before claiming it is saved. |
| 12 | P2 · Observed | Course advertises about 10 hours; setup totals 762 minutes, which is 12 hours 42 minutes. | Derive total duration from the delivery manifest and explain whether it includes project and assessment. |
| 13 | P2 · Observed and source confirmed | Dashboard shows Topic 2 of 7; player shows Part 2 of 11 because concept videos are separate parts. Resume shows 87 minutes for a 20-minute worked topic; code estimates the remainder of the module. | Define “part” consistently. Show “20 min for this part” and a separate module remainder. |
| 14 | P2 · Observed | Setup selects “Lighter touch” but says every lesson starts with more help. | Explain the difference between quick-check recommendation and the learner's override, and display the effective choice. |
| 15 | P2 · Observed | Search for “memory” returns No matches despite a memory module and lessons. | Extend search to module titles, concepts, transcript passages, notes and glossary entries; deep-link results. |
| 16 | P2 · Observed | Worked examples show selectors “1.2”, “1.1”, “1.2”. Two examples have the same visible label. | Use “Run 1 · FAQ chatbot” and similarly distinct titles, with current and completed states. |
| 17 | P2 · Source confirmed | Hero asks what the learner wants to achieve, but submit drops `goal` and routes to sign-in. | Carry the goal into an onboarding draft or remove the field until it is used. |
| 18 | P2 · Observed and source confirmed | Beginner course says no prior experience; guided practice requires Python, terminal, Anthropic account and API credit. | Disclose requirements and potential cost before enrollment. Offer a deterministic browser practice route alongside optional real API work. |
| 19 | P2 · Source confirmed | Project editor and Python runtime load from jsdelivr on first use. A fresh offline browser cannot obtain these assets. | Bundle or explicitly pre-download practice assets with readiness checks and a fallback editor. The network failure itself was not reproduced. |
| 20 | P2 · Observed and source confirmed | Privacy, Terms and Accessibility footer links lead home. Reset help says browser data, but reset also deletes server learner data. Profile says changes apply to the next topic, while courses retain separate setups. | Replace placeholder links; describe reset scope accurately; clarify when profile edits apply and offer Apply to this course. |
| 21 | P2 · Source confirmed | Final-question dots use a 10-pixel target, and selecting a first MC answer advances after 300 ms. | Provide at least 24 × 24 CSS-pixel targets, preferably larger touch targets, and explicit Next by default. Offer auto-advance only as a preference. |
| 22 | P2 · Source confirmed | Minutes this week comes from fixture `daily_progress`, rather than measured study time. | Measure active study time consistently or omit the metric until connected. Keep internal adaptation signals private. |
| 23 | P2 · Observed and source confirmed | Personalized capstone asks for an end-to-end agent and report; actual workspace asks for `prompt_engine.py`. | Bound generated briefs to the actual task, files and rubric; identify optional extension work separately. |
| 24 | P3 · Observed | Open Notifications from the catalog. The panel contains only its heading, with no empty-state explanation. Catalog introduction also promises six setup questions while profile contains seven. | Show “You're all caught up” when there are no notifications and derive questionnaire counts from the actual definition. |

## Source locations for engineering

These references explain the findings; they are not changes made by this audit.

- `apps/web/src/components/marketing/sign-in-form.tsx:23` — demo sign-in paths.
- `apps/web/src/components/player/tutor-dock.tsx:77` — one-word lexical match can select a passage; `:171` — generic suggestions; `:291` — citations are text rather than lesson links.
- `packages/i18n/en.json:406` — suggestions unrelated to the current module.
- `apps/web/src/components/player/stages/gate-stage.tsx:68` — in-memory assessment responses; `:296` — auto-advance; `:326` — small question dots.
- `apps/web/src/components/player/stages/review-stage.tsx:49` — all future variants rendered together.
- `apps/web/src/lib/plan.ts:106` — planner builds non-adapted topic units; `:124` — durations scaled from defaults.
- `apps/web/src/components/plan/use-plan.ts:24` — plan remains local to this browser.
- `apps/web/src/data/index.ts:114` — fixed date.
- `apps/web/src/components/learn/home-dashboard.tsx:150` — fixture study minutes; `:155` — fixture due reviews.
- `apps/web/src/lib/course-progress.ts:104` — resume estimate uses module remainder.
- `apps/web/src/components/enroll/customize-step.tsx:232` — quick-check message does not account for override.
- `apps/web/src/components/finale/wrap-up-stage.tsx:29` — missing verification route; `:220` — demo completion bypass.
- `apps/web/src/components/learn/credential-card.tsx:45` — verifiable label before verification exists.
- `apps/web/src/components/learn/settings-form.tsx:116` — local reminder preference; `:150` — server reset.
- `apps/web/src/components/project/workspace.tsx:37` — load error not consumed; `:43` — starter initialization.
- `apps/web/src/components/project/code-editor.tsx:12` — external editor loader.
- `apps/web/src/components/project/python-sandbox.ts:13` — external Python runtime.
- `apps/web/src/components/player/progress.ts:32` — silent completion-save failure.
- `apps/web/src/components/marketing/hero.tsx:84` — goal discarded.
- `apps/web/src/components/marketing/site-footer.tsx:14` — placeholder legal links.

## Patterns from other learning platforms

The adaptations below are product recommendations. A competitor feature is inspiration, not evidence that it will improve this app's retention.

| Platform | Official evidence | Apply to Nebula KnowLab |
| --- | --- | --- |
| Coursera | Transcript highlights, timestamp-linked notes and calendar support described in [learning experience updates](https://blog.coursera.org/updates-to-your-learning-experience-on-coursera/). This is a historical feature announcement, not a current account test. | Add a notebook connected to lesson and slide; offer calendar export after the planner is accurate. |
| Udemy | [Notes](https://support.udemy.com/hc/en-us/articles/360038492834-How-to-create-and-use-notes-on-a-browser) connect notes to a lecture position. [Course Q&A](https://support.udemy.com/hc/en-us/articles/229233387-How-to-Ask-a-Question-About-a-Course-You-re-Taking) supports search, questions and following replies, with access conditions. | Add searchable lesson notes and an Ask for help path when tutor retrieval fails. |
| Khan Academy | [Mastery Challenges](https://support.khanacademy.org/hc/en-us/articles/360037494231-What-are-Mastery-Challenges) revisit previously practiced skills using personalized mixed questions; the page limits availability to math courses. | Offer a short review queue based on learning needs, without copying visible levels or rankings. |
| Codecademy | [AI assistant design](https://www.codecademy.com/resources/blog/behind-the-build-ai-learning-assistant) describes exercise/code context and hints before solutions. | Let the tutor understand the current lesson and selected code, cite navigable sources, and provide a hint ladder. |
| DataCamp | [Projects overview](https://support.datacamp.com/hc/en-us/articles/360006091334-DataCamp-Projects-An-Overview) describes browser coding, authentic projects and sharing through DataLab. | Bring small executable tasks earlier in the course; export completed work and test evidence. |
| edX | [Audit and verified tracks](https://support.edx.org/hc/en-us/articles/360013426573-What-are-the-differences-between-audit-free-and-verified-paid-courses) distinguish learning access, graded work and credentials. | Clearly distinguish preview/demo access, assessed completion and genuine credentials. |
| Duolingo | [Spaced repetition](https://blog.duolingo.com/spaced-repetition-for-learning/) explains revisiting material over time; [streak help](https://www.duolingo.com/help/what-is-a-streak) describes continuity and streak freezes. | Build brief recall sessions and forgiving weekly goals. Avoid punitive streaks or public leaderboards. |

## Proposed feature backlog

Effort is relative: S is a small scoped change, M spans several components and data flows, L needs substantial backend or curriculum work. Estimates need refinement after implementation design.

| Feature | Learner experience and first release | Priority | Effort and dependencies | Acceptance condition |
| --- | --- | --- | --- | --- |
| Dependable resume | Resume the exact video slide, practice step or assessment draft; visible saved/syncing/retry status | P1 | M · persistence model and event IDs | Refresh or switch routes and return to the same saved work; failed saves remain recoverable |
| Unified course manifest | One definition of delivery order, parts, duration and completion | P1 | M · content and planner integration | Dashboard, plan, outline and player agree for all learner ordering choices |
| Real recall queue | “Review today · 5 minutes,” due items, recall history, snooze and catch-up | P1 | L · due-item storage and scheduling | Module completion produces dated items; answering one updates its next due date |
| Notebook and bookmarks | Save a note at a slide or practice step, search it, jump back and export | P2 | M · stable lesson references | Notes survive reload and export with source links; private by default |
| Course search and glossary | Search concept titles and transcripts; definitions on unfamiliar terms | P2 | M · local content index | “Memory” finds the correct module, lessons and relevant passages |
| Contextual tutor | Module suggestions, Explain this, escalating hints and clickable citations | P1 then P2 | M for authored retrieval; L for optional model service | Suggestions work; unclear queries ask a clarifying question; checks remain protected |
| First successful build | Run a tiny deterministic example during M1, then optional real API setup | P2 | L · reusable sandbox and content | A beginner completes the first practice task without a paid key |
| Project recovery and export | Local draft backup, retry save, file download, saved versions, restore and test freshness | P1 then P2 | M · work revision IDs | Load failures cannot replace saved work; exported project includes instructions and report |
| Flexible study sessions | Break large topics into 10–30-minute parts, finish estimate and explicit reschedule | P2 | M · unified manifest | A 10-minute plan does not silently schedule a 120-minute project as one indivisible session |
| Calendar and reminders | Calendar export first; opt-in reminders with quiet hours, timezone and unsubscribe later | P2 | S for export; L for delivery | Exported dates match local study days; reminders stop after completion or opt-out |
| Remediation after checks | Link missed concepts to exact lessons and a short practice task | P2 | M · attempt history and variant questions | Retake preparation covers the missed idea without revealing final answers in advance |
| Human help and reporting | Report lesson problem; ask course question with a lesson link; response status | P2 | L · support ownership and moderation | A stuck learner can reach a accountable help path and see what happens next |
| Portfolio and credentials | Download code and evidence first; genuine public credential after assessment rules exist | P2 | M for export; L for issuance | Unique verification URL resolves; demo samples never claim earned competence |
| Mobile and reading mode | Readable transcript-first lessons, large controls, collapsible workspace panes, large-text support | P2 | M · layout and accessibility review | At 390px and 200% zoom, content and primary actions remain usable |
| Offline lesson packs | Download narration, transcripts and practice runtime with a readiness indicator | P2 | L · asset packaging, cache versioning and sync | A fresh prepared offline session can study and recover work without network |
| Later course expansion | Role-based paths and next courses after evidence from the first course | P3 | L · new authored and reviewed content | Recommendations follow learner goals and prerequisite knowledge |

## Delivery plan

These are planning windows for one small product team, not committed deadlines. Ship each phase once its acceptance conditions pass.

### Phase 1 Fix trust and continuity

**Suggested weeks 1–2.** Label demo behavior accurately; repair misleading legal/service/credential copy; fix tutor suggestions and setup contradictions; handle project-load and progress-save failures; preserve assessment drafts; replace fixture dates. Clarify the capstone brief and external setup requirements. Increase assessment targets and remove forced auto-advance by default.

Exit conditions: no verification link leads to 404; unavailable services cannot masquerade as active services; leaving a check preserves responses; failed project loads never overwrite work; failed saves show a recovery path. Demo access remains open.

### Phase 2 Make planning match learning

**Suggested weeks 3–4.** Introduce the delivery manifest; reconcile topic counts and durations; use learner order in the calendar; create small schedulable lesson units; implement exact lesson resume. Add concept search, glossary and bookmarks.

Exit conditions: every planner item opens the intended part; time and order match the player; “Memory” search succeeds; a scheduled short session can be completed in the advertised scope.

### Phase 3 Build the return habit

**Suggested weeks 5–7.** Implement real due-review storage and scheduling, a dashboard review queue, recoverable catch-up, notebook and calendar export. Add measured study time only after its definition and storage are settled. Pilot reminders after opt-in and delivery controls exist.

Exit conditions: simulated 3-, 10- and 30-day transitions produce the right review items; repeated completion does not duplicate reminders; overdue items remain reachable; a learner can change their week without losing progress.

### Phase 4 Improve support and proof of skill

**Suggested weeks 8–10.** Add browser micro-practice, tutor context and navigable citations, project export/version recovery and a lesson help path. Build real credentials only after authentication, assessment authority and credential storage are ready. Package offline assets as a separate capability rather than silently promising universal offline support.

Exit conditions: first practice works without API credit; help references the active task; exported work reproduces the learner's project; genuine credentials meet verified requirements.

### Later expansion

Add cohorts, mentor review, multilingual course content and more courses after the first-course learning flow is reliable. Public leaderboards, punitive streaks, social feeds and a native mobile app should not precede saved work, useful help and working recall.

## Engineering constraints

- Keep existing progress identifiers stable; map new delivery parts to existing records rather than renaming completed stages.
- Version persisted data and migrate existing learner state. Add course IDs to any new cross-course local keys.
- Maintain pure planning/adaptation helpers and reuse the existing UI/token/i18n layers.
- Keep demo exploration unrestricted, while separating exploration from assessed mastery.
- Maintain a deterministic practice and tutor fallback when external AI is unavailable.
- Final assessment content and pass rules remain fixed. Personalize preparation and remediation, not the assessment itself.
- Keep internal telemetry and adaptation signals out of learner-facing levels and scores. Assessment results may retain their existing pass/result presentation.
- The actual app is Next.js/TypeScript with a local backend, despite the stale agent guide. Reconcile repository guidance before implementation; do not transplant the old Vite paths or store assumptions.
- Update the relevant architecture, design and backend documents when features are implemented. This audit changes no app behavior.

## Validation and success measures

Run usability sessions with five beginners and three returning learners: start the course, find a concept, resume interrupted work, recover a save failure, schedule a short session, complete a practice task and return for a due review. Include keyboard navigation, a screen-reader pass, reduced motion, both themes, 200% zoom and a narrow viewport. Exercise network loss during project load and save, reload during an assessment, multiple tabs and timezone boundaries. Use a disposable learner for reset and full completion testing.

Suggested product measures are time to first useful practice, enrollment-to-first-lesson conversion, successful resume rate, work-loss incidents, first-practice success, return for due review, and learner-rated helpfulness of tutor answers. Collect a baseline before setting improvement percentages. Operational acceptance targets should include zero unresolved critical work-loss bugs and zero broken primary actions or credential links in the release smoke test.

For the implementation phase, run the current app's `npm run lint`, `npm run typecheck` and `npm run build`, plus targeted backend checks and the learner smoke path. These were not run for this documentation-only audit; no compilation claim is made.
