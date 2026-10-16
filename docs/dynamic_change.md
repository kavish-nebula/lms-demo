# Current task: export this plan as a PDF

**Goal:** a shareable PDF of the dynamic-question plan below, plus the latency answer given in chat. Nothing in the app changes.

**How (same as the existing `docs/feature-ideas.html` → `docs/feature-ideas.pdf`):**
1. Write `docs/dynamic-profiling-plan.html`:
   - A4 print CSS, copying the styling of `docs/feature-ideas.html` (Segoe UI, purple brand rule under each heading, boxed panels, chips, `@page` A4 margins, `break-inside: avoid`).
   - Fully self-contained: no external fonts or scripts.
2. PDF sections:
   1. Title, status ("Approved plan, not yet built", 15 Oct 2026) and a one-paragraph summary.
   2. Today vs proposed: 6 fixed questions → a domain-first branching flow.
   3. Architecture: an inline SVG diagram (browser → orchestrator → rules / LLM / fallback → planner → narrator), plus the "who decides what" table.
   4. How questions change by domain: the Step 1 options, the domain pack table (IT, manufacturing, retail, finance, healthcare, education, student, something else), the Step 3 common questions with skip and wording rules, two example paths drawn as step strips (retail support agent, CS undergraduate), and the prune / validate / limit rules.
   5. LLM layer: provider-neutral env settings and the three bounded calls.
   6. Narrator: live TTS with cache and MP3 fallback.
   7. Latency: the table from chat (rule picks ~0 ms; LLM ~0.5–3 s, hidden) and the four ways the wait is hidden.
   8. Data and API; build order (5 phases); verification; what's needed from you.
3. Render with headless Edge, which is already installed:
   `msedge --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="C:\lms-platform\docs\dynamic-profiling-plan.pdf" file:///C:/lms-platform/docs/dynamic-profiling-plan.html`
4. Check it:
   - open the PDF with the Read tool and look at every page: no clipped tables, headings not stranded at page bottoms, the diagram legible
   - fix the CSS and re-render if needed
5. Send the PDF to you with SendUserFile. Don't commit.

---

# Plan: Dynamic profiling by work domain: rules + LLM + narrator, in the existing backend

## Context

Today every learner answers the same 6 fixed questions plus a comfort question (`apps/web/src/lib/setup.ts:29-114`). You want:

1. Profiling to start from the learner's **work domain**, with every following question **changing based on that domain** and on later answers.
2. A backend that combines **rules + an LLM + a narrator + agent-style orchestration**.
3. **No dependency on GLM.** You will provide an API key for a different model.

All of this fits inside the existing Next.js server (`apps/web/src/server`, `/api/v1/*` routes, Postgres/PGlite). No separate backend is needed.

---

## 1. Architecture

```
Browser (profile-step UI)
   │  POST /api/v1/profiling/next  { answers }          ← one call per answer
   ▼
Profiling orchestrator  (server/profiling/engine.ts)   ← controls the loop; never the LLM
   ├─ Rule engine: question bank + domain packs + skip/infer rules (deterministic, tested)
   ├─ LLM helper (bounded): interpret free text, propose ≤2 follow-ups, write domain vocabulary
   │     └─ validated against a schema → on failure or no key, fall back to the rule result
   └─ returns { next question | done, profile so far }
   ▼
Profile builder → existing planner (server/planner) → plan: order, help level, "In your world", hook, capstone
   ▼
Narrator service (server/narrator): voice/pace/captions prefs → live TTS with cache → fallback to the current MP3s
```

**Who decides what:**

| Decision | Done by | Why |
|---|---|---|
| First question (work domain) | Rule | Same starting point for everyone |
| Which questions are eligible next | Rule (domain pack + `when` conditions) | Predictable and testable |
| Skipping questions already implied ("developer who uses Python" → no coding question) | Rule (infer table) | Shorter and reliable |
| Understanding a typed answer ("I run a dental clinic") | LLM → mapped to a known pack | Free text varies too much for rules |
| A follow-up when no pack fits or an answer is vague | LLM, max 2, schema-checked | Covers gaps in the bank |
| Domain words for examples (what a "record" or "ticket" is in their field) | LLM (rule template when there is no key) | Makes examples feel like the learner's own work |
| When to stop asking | Rule (all required fields filled, or the question limit reached) | No endless interview |
| Course plan | Existing planner (LLM) + rule baseline | Already built and validated |
| Narrator voice and pace | Learner choice → TTS provider | Only offers voices that actually exist |

**The "AI agent" part.** The profiling orchestrator works like an agent, with tools: read profile, candidate questions, save answer, ask the LLM. But **the server runs the loop**: a fixed number of steps, every LLM output validated, rule fallback at each step. This is the "LLM + your own orchestrator" option from your pasted design. It is predictable, debuggable, and works without a key. Pip (the tutor) and the planner are separate agents that already follow the same pattern.

---

## 2. How the questions change with the work domain

### Step 1: always asked
**"Which field have you worked in?"** IT & software · Manufacturing · Retail & e-commerce · Finance · Healthcare · Education · I'm a student / no work experience yet · Something else (typed)

### Step 2: the domain picks a question pack (rules)
Each pack asks **role → the tools or systems they use → the first job they'd hand to an agent**. That last answer drives the examples, the hook framing and the capstone brief.

| Domain | Role options | Then asks (domain-specific) | "What would you hand to an agent first?" |
|---|---|---|---|
| **IT & software** | Developer · Support / service desk · DevOps / SRE · Data · IT manager | Languages and tools used (multi): Python, JavaScript, APIs, cloud, ticketing | Ticket triage · Incident summaries · Code review notes · Internal FAQ bot |
| **Manufacturing** | Production / process engineer · Maintenance · Quality · Plant / shift manager · Supply chain | Systems you touch: MES/ERP, sensors/SCADA, spreadsheets, maintenance tickets | Maintenance alerts · Quality reports · Shift handover notes · Supplier emails |
| **Retail & e-commerce** | Operations · E-commerce · Customer support · Marketing · Merchandising | Store platform, order system, helpdesk, spreadsheets | "Where is my order?" replies · Returns · Product questions · Stock alerts |
| **Finance** | Accounts / AP · Analyst · Operations · Compliance · Manager | ERP, Excel, invoices by email, reporting tools | Invoice matching · Report summaries · Compliance checks · Client queries |
| **Healthcare** | Clinician · Admin / front desk · Health IT · Research | Scheduling, records, email (with a note: never real patient data) | Appointment FAQs · Scheduling help · Document summaries |
| **Education** | Teacher · Admin · Instructional designer · EdTech | LMS, spreadsheets, forms | Answering student FAQs · Marking support · Course admin |
| **Student** | *(no role question)* → **Level**: school · undergrad · postgrad · recent graduate · self-learner → **Subject**: CS/IT · engineering · business · science · arts · other | "Have you built a project before?" none / class exercises / my own project | Course goals instead: do well in my studies · portfolio project · internship or job · curious |
| **Something else (typed)** | The LLM maps the text to the nearest pack, or writes ≤2 validated follow-ups. With no key: a generic pack (role typed, "what do you do day to day?") | | |

### Step 3: common questions, adjusted by earlier answers
- **Years in this field**: professionals only.
- **Experience with AI agents**: everyone.
- **Coding**: skipped when already implied (an IT developer who picked Python is inferred as `python`). For managers and non-technical roles it is worded "Have you ever written code or scripts?".
- **Learning preferences**: what helps first, explanation style.
- **Narrator**: voice (with a preview), speaking pace, captions on/off.
- **Comfort**: larger text, less motion.

### Two example paths
- **A retail support agent:** Field → Retail · Role → Customer support · Tools → helpdesk + order system · First job → "Where is my order?" replies · AI experience → never · Coding → "Have you ever written code or scripts?" → no · Narrator → calm, slower.
  *Result:* extra help on code lessons. Examples use orders and helpdesk tickets (the course story, Orbit Outdoor, is already retail). The capstone is framed as automating their own order replies.
- **A CS undergraduate:** Field → Student · Level → undergrad · Subject → CS · Project → own project · Goal → internship · Coding → (asked) Python.
  *Result:* light help on code lessons. Examples use coursework (submissions, a TA). The capstone is framed as something to walk through in an interview.

### Rules that keep it clean
- **Prune:** if the domain changes, answers from the old pack are dropped (on the client and on the server).
- **Validate:** only values from the current options are stored.
- **Limit:** at most about 10 screens. Every question can be skipped.

---

## 3. LLM layer: any provider, no GLM dependency

- Generalise `server/glm.ts` into a **provider-neutral client**, `server/ai/llm.ts`, configured in `.env.local`:
  `LLM_PROVIDER` (`openai-compatible` | `anthropic`), `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_FALLBACK_MODEL`.
  - The **OpenAI-compatible** adapter covers OpenAI, DeepSeek, Groq, Mistral, OpenRouter, Together, local Ollama, and GLM.
  - An **Anthropic** adapter covers Claude, if that is the key you bring.
- The planner (`server/planner/llm.ts`), Pip (`server/companion/service.ts`) and the new profiling helper all use this client. The existing `GLM_*` variables are read as a fallback, so nothing breaks before the new key arrives.
- Each LLM call: JSON output → schema check (zod) → on failure, rule fallback. Prompts never name the provider. Tests use a stub, as today.
- **Three bounded profiling calls:**
  1. `interpretFreeText(text)` → `{ pack, roleGuess, confidence }`.
  2. `followUps(profile, missingFields)` → ≤2 questions `{ id, q, options[2–5], fills }`. These are rejected if they are off-topic, duplicate a question, or touch sensitive personal data.
  3. `domainVocabulary(field, role)` → `{ trigger, item, items, junk, action, team }`. This replaces the generic `customDomain` nouns used in "In your world" cards.

---

## 4. Narrator (live TTS, as you chose)

- **Profiling** asks voice (2–4 options, each with a sample), pace (0.9 / 1 / 1.15) and captions. These are saved on the profile.
- **`server/narrator`** + `GET /api/v1/narration?text|clipId&voice&rate`:
  - It calls the TTS provider for the key you supply (OpenAI TTS, ElevenLabs or Azure; one adapter, chosen in env).
  - Audio is cached as a file keyed by `hash(voice|rate|text)`, so each clip is synthesised once.
- **Players** (`video-lesson.tsx:40`, hook `film.tsx`, `replay.tsx`, `roleplay-mission.tsx`) build their audio URL from the learner's voice:
  - Default voice → the existing committed MP3s, so nothing changes.
  - Chosen voice → the narration route.
  - Route fails or no key → falls back to the committed MP3. Demo mode keeps working offline.
- This also makes it possible later to **speak personalised lines**, such as the learner's own "In your world" example.

---

## 5. Data and API

- `POST /api/v1/profiling/next` with `{ answers }` returns `{ question | done, skipped, inferred }`. The UI calls it after each answer; a client copy of the rules gives an instant answer while the server one loads.
- `profiles.answers` (jsonb) gets the pack answers. New jsonb column `profiles.derived` holds the LLM results: mapped pack, domain vocabulary, follow-up Q&A, and the model and prompt version. Migration via `npx drizzle-kit generate`.
- `enrollments.answers` is pruned the same way. Existing rows stay valid: every old value still exists in the bank.

---

## 6. Build order (each phase approved and verified separately)

1. **Provider-neutral LLM client.** Swap GLM out of the planner and Pip; read the new `LLM_*` env.
2. **Rule engine + domain packs.** Question bank with `when`, packs, infer and prune rules, branching UI, server pruning, planner prompt and baseline using the new answers. Works with no key.
3. **LLM help in profiling.** Free-text mapping, ≤2 follow-ups, domain vocabulary, `profiles.derived`.
4. **Narrator.** Profiling questions, narration route with cache, player URL switch, MP3 fallback.
5. **Show personalisation in lessons.** Render the planner's per-learner `inYourWorld` and `hookScene` (currently generated but not shown: `video-explainer.tsx:33`, `hook-cinema.tsx:448`).

## Critical files
- New: `server/ai/llm.ts`, `server/profiling/engine.ts` (+ `packs.ts`), `server/narrator/*`, `app/api/v1/profiling/next/route.ts`, `app/api/v1/narration/route.ts`.
- Changed:
  - `lib/setup.ts` (bank, `questionsFor`, `pruneAnswers`, infer)
  - `lib/world.ts` (student and LLM vocabulary domains)
  - `components/enroll/profile-step.tsx` (screens by question id)
  - `components/learn/profile-editor.tsx`
  - `server/validators.ts`, `server/planner/{llm,baseline,context,service}.ts`, `server/companion/service.ts`, `server/db/schema.ts`
  - the player audio-URL sites listed above
  - `docs/architecture.md`

## Verification
- `npm run typecheck`; eslint on changed files; all backend suites (`node tests/backend/run.mjs` [companion|workflow|engagement]).
- New tests:
  - each domain path gives the right questions
  - prune when the domain changes
  - infer skips (developer + Python → no coding question)
  - a bad LLM follow-up is rejected and the rule fallback is used
  - no key → the rules work end to end
  - narration cache hit/miss, and MP3 fallback when the provider fails
- Browser (dev server on :3000):
  - walk the Retail, IT, Student and "Something else" paths and screenshot each
  - switch domain mid-way and confirm the old answers are gone
  - build and check the plan summary
  - play a video with a non-default voice, then with the key removed (falls back to the MP3)

## Needed from you
- **LLM key and provider name** (Phase 1, 3).
- **TTS provider key** (Phase 4).
- **Confirm the domain list and pack options above** (Phase 2): rename or add fields as needed.
