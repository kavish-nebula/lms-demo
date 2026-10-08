# Nebula KnowLab — Backend System Plan

> Production-ready backend for the Proofcraft LMS prototype (`lms-feature/`).
> Stack: **Python (FastAPI) · PostgreSQL · cloud-native**. Scope: **full platform** —
> auth, progress sync, adaptive engine, assessments, credentials, content pipeline,
> Patch AI assistant, analytics, and instructor dashboards.

---

## 1. Goals & principles

| # | Principle | Why |
|---|-----------|-----|
| 1 | **Modular monolith first** | One deployable FastAPI app with strict module boundaries (`auth`, `learners`, `progress`, `assessment`, `content`, `patch`, `analytics`). Microservices are extraction paths, not starting points. |
| 2 | **Server is the source of truth** | The client's Zustand/localStorage stores become a *cache + offline buffer*. Grades, answers, and credentials live server-side. |
| 3 | **Progress is an event log** | The app already models progress as stage keys (`hook`, `1.1-explain`, `guided`, `quiz`…). Persist these as append-only events with idempotency keys; project them into a read state. Gives analytics for free. |
| 4 | **Deterministic adaptivity, versioned** | The adaptive engine (`src/engine/adaptive.js`) is pure functions — port 1:1 to Python, version the rule pack, store which version produced each decision (auditability, reproducibility). |
| 5 | **Answers never ship to the client** | Today the final-assessment answer key sits in the JS bundle (`course.js`). Assessment delivery and scoring move server-side. |
| 6 | **Demo mode survives** | The current localStorage experience stays as a demo/offline tier; a sync client replays buffered events when connectivity returns. |

**Non-goals (v1):** payments/e-commerce, live video streaming (narration stays static MP3s on CDN), SCORM/xAPI/LTI compliance, mobile native apps.

---

## 2. High-level architecture

```mermaid
flowchart LR
  subgraph Client
    SPA["React SPA\n(Vite)"]
  end

  subgraph Edge
    CF["CloudFront + WAF"]
    S3C["S3: static app +\naudio/content bundles"]
  end

  subgraph Platform["FastAPI modular monolith (ECS Fargate, ALB)"]
    API["REST /v1\nauth · learners · progress\nassessment · content"]
    PATCH["Patch service\n(RAG pipeline)"]
    ADAPT["Adaptive engine\n(pure Python, versioned)"]
    WORKERS["Async workers\n(credentials, analytics rollup,\nembeddings)"]
  end

  subgraph Data
    PG [("PostgreSQL (RDS)\n+ pgvector")]
    REDIS [("ElastiCache Redis\n(rate limit, cache)")]
    S3D["S3: assets, exports"]
    WH[("Warehouse\nAthena/QuickSight")]
  end

  SPA --> CF --> API
  CF --> S3C
  API --> PG
  API --> REDIS
  PATCH --> PG
  WORKERS --> PG
  WORKERS --> WH
  API --> WH
  ADAPT --> API
```

- **Compute:** ECS Fargate (2 services: `api`, `worker`) behind an ALB. FastAPI + Uvicorn, containerized.
- **Database:** RDS PostgreSQL 16 with **pgvector** — one database covers relational data *and* Patch embeddings (no separate vector DB until scale demands it).
- **Cache/limits:** Redis for rate limiting, session-ish caches, and Patch answer cache.
- **Static:** SPA build, audio MP3s, and published content bundles on S3 + CloudFront. The SPA talks to the API via `/v1` on the same domain (cookies or bearer both work; see §8).

---

## 3. Data model (PostgreSQL)

Grounded in the existing stores: `pc-learner` (profile, precheck, drills, reference book), `pc-course` (stages, quiz results, capstone, final), plus plan/portfolio/review/signals.

```
users                    user_id (pk), oidc_sub (uq), email, name, roles[], created_at, disabled_at
learner_profiles         user_id (pk, fk users), domain, role, experience, goal_text,
                         settings jsonb (reduce_motion, text_scale), updated_at
courses                  course_id (pk), slug (uq), title, current_version_id (fk content_versions)
content_versions         version_id (pk), course_id (fk), semver, checksum, bundle_s3_key,
                         adaptive_rules_version, published_at, published_by, status
enrollments              enrollment_id (pk), user_id (fk), course_id (fk), content_version_id (fk),
                         state (active|completed|archived), demo_mode bool, created_at, completed_at
precheck_results         precheck_id (pk), enrollment_id (fk), is_new bool, skipped bool,
                         lessons jsonb ({subId: items_right 0–2}), created_at
progress_events          event_id bigserial, enrollment_id (fk), client_event_id (uq per enrollment — idempotency),
                         type (stage_completed|guided_done|quiz_submitted|capstone_saved|final_submitted|…),
                         module_id, stage_key, payload jsonb, occurred_at, ingested_at
progress_state           enrollment_id (pk), projection jsonb (mirrors today's useCourse shape),
                         plan jsonb (server-computed adaptations), updated_at
assessment_attempts      attempt_id (pk), enrollment_id (fk), assessment_type (precheck|module_quiz|final),
                         module_id null, question_ids uuid[], responses jsonb,
                         score numeric, total int, passed bool, started_at, submitted_at
signals                  signal_id (pk), enrollment_id (fk), kind (check_failed|replayed|hint_used),
                         module_id, sub_id, payload jsonb, occurred_at
credentials              credential_id (pk), enrollment_id (fk), user_id (fk), course_id (fk),
                         kind (module|course|skill), payload jsonb, signature text, issued_at, revoked_at
patch_conversations      conversation_id (pk), user_id, enrollment_id, created_at
patch_messages           message_id (pk), conversation_id (fk), role (user|assistant), content,
                         citations jsonb, latency_ms, created_at
adaptation_log           log_id (pk), enrollment_id, rules_version, input jsonb, decision jsonb, created_at
```

Key choices:

- **`progress_events` + `progress_state`** — append-only truth, projected read model. Event writes are idempotent via `client_event_id`, so the client can fire-and-forget batches and replay offline queues safely.
- **`adaptation_log`** — every adaptive decision (support level, lesson ordering, analogy shown) is recorded with the rule-pack version. The LMS's promise is "every adaptation is shown and explained" — this makes it auditable.
- **`assessment_attempts.question_ids`** — questions are served per-attempt in a fixed/seeded order; the row is the receipt.

---

## 4. API design (REST, `/v1`, JSON)

All routes JWT-authenticated except auth endpoints and public credential verification. Tenant scoping: learners see only their enrollments; staff roles gate `/admin`.

### Identity & profile
```
GET    /v1/me                                  → user + profile + settings
PUT    /v1/me/profile                          → save profile questionnaire (domain, role, experience…)
PATCH  /v1/me/settings                         → accessibility settings (reduce motion, text scale)
```

### Enrollment & learning
```
POST   /v1/enrollments                         → { course_id } (idempotent per user+course)
GET    /v1/enrollments/{id}                    → enrollment + projected progress + resume pointer (`last`)
POST   /v1/enrollments/{id}/precheck           → submit pre-assessment → 201 + computed adaptation plan
POST   /v1/enrollments/{id}/events             → batch progress events (array, idempotent) → 202
GET    /v1/enrollments/{id}/plan               → current learning plan + per-lesson adaptations
POST   /v1/enrollments/{id}/signals            → behavioral signals (failed checks, replays) → 202
PUT    /v1/enrollments/{id}/capstone           → save accepted capstone build
PUT    /v1/enrollments/{id}/teachbacks         → reference-book entries
GET    /v1/content/bundle?course=slug&v=semver → published content bundle (or 302 → CDN URL)
```

### Assessments (answer keys live here, not in the SPA)
```
POST   /v1/enrollments/{id}/assessments/{type}/attempts       → creates attempt, returns questions WITHOUT answers
POST   /v1/assessment-attempts/{id}/submit                    → server scores, returns result + explanations
GET    /v1/assessment-attempts/{id}                           → attempt + scored result
```

### Credentials
```
GET    /v1/me/credentials                      → issued credentials
GET    /v1/credentials/{id}                    → public verification payload + signature
POST   /v1/credentials/{id}/verify             → cryptographic verification result
```

### Patch (AI assistant)
```
POST   /v1/patch/query                         → { enrollment_id, question, conversation_id? }
                                                 → grounded answer + citations (course-scoped only)
```

### Instructor / admin
```
GET    /v1/admin/courses/{id}/cohorts          → cohort list, completion funnel
GET    /v1/admin/courses/{id}/learners         → per-learner progress, at-risk flags
GET    /v1/admin/assessments/{id}/items        → item analysis (difficulty, discrimination)
POST   /v1/admin/content/versions              → register/validate/publish content bundle (§6)
GET    /v1/admin/analytics/*                   → aggregates (see §9)
```

Conventions: cursor pagination; RFC 7807 problem+json errors; `Idempotency-Key` header on all POSTs that create resources; version every rule-dependent response with `adaptive_rules_version`.

---

## 5. Adaptive engine (server-side port)

`src/engine/adaptive.js` ports to `app/adaptive/` as pure Python — no I/O, fully unit-testable against fixtures generated from the JS implementation during migration.

```
app/adaptive/
  rules_v1.py        # stated support (profile) → measured support (precheck) → behavioral (signals)
  ordering.py        # example/idea/try lesson ordering
  analogy.py         # when to surface the analogy layer
  world.py           # domain/"in your world" rewrites (manufacturing, IT, retail, finance, custom)
  engine.py          # compose(profile, precheck, signals) → AdaptationPlan; versioned
```

Flow:

1. Learner submits profile → server computes and stores initial plan in `progress_state.plan`.
2. Pre-assessment submitted → recompute (measured layer), log to `adaptation_log`.
3. During lessons, the client posts `signals` (two failed checks, replays) → worker recomputes affected lessons, pushes updated plan on next fetch (or via SSE later).

The client keeps a thin mirrored copy of the rules **only for demo mode**; in connected mode it renders whatever `GET /plan` returns, so the server rule pack can evolve independently of the SPA.

---

## 6. Content pipeline (content-as-code)

Course content today is hand-written JS (`course.js`, `modules/m1–m4.js`, `videos/*.js`). Keep authoring in **git**, add a publish pipeline — no authoring UI needed for v1:

```
content repo (YAML/JSON per module, JSON-Schema validated)
        │  CI: schema validation, answer-key audit, audio-file existence check,
        │  narration ↔ beat cross-check, adaptive-rule lint (every question maps to subIds)
        ▼
POST /v1/admin/content/versions   → server re-validates, stores checksum, uploads bundle
        ▼
bundle JSON on S3/CloudFront + content_versions row → SPA fetches bundle at boot, caches by version
```

Benefits: reviewable diffs, reproducible courses, per-enrollment content pinning (`enrollments.content_version_id`) so a mid-cohort content change can't corrupt in-flight progress.

---

## 7. Assessments & credentials

**Delivery & scoring**
- Attempt creation assigns question IDs and a seeded order; questions are returned *without* `correct`/`explain`.
- Scoring is server-side, single submit per attempt, server-enforced time window (optional).
- Final assessment: pass mark 0.8, same questions for everyone (per current spec) — but stored as a `question_bank` table from day one so randomized variants can ship later without schema changes.

**Credentials**
- On pass, a worker issues a **signed credential**: canonical JSON payload + Ed25519 signature (key in AWS Secrets Manager/KMS).
- Public verification: `GET /v1/credentials/{id}` returns payload + signature; `POST /verify` validates. This replaces the current client-side `CredentialCard` mock with a verifiable artifact, while the UI stays identical.

**Integrity (proportionate)**
- Rate-limited attempts, no answer feedback until submit, quiz question order stable per enrollment but answer options shuffled per attempt.

---

## 8. Auth & security

- **OIDC via managed IdP** (Cognito recommended on AWS; Auth0/Entra ID equally pluggable). The API validates JWTs (issuer/audience), maps `oidc_sub → users`. No password storage, no refresh-token handling in our code.
- **Authorization:** role claims (`learner`, `instructor`, `admin`) + object-level checks (enrollment ownership) via FastAPI dependencies.
- **Transport:** HTTPS only, HSTS; API on same domain as SPA (`/v1` path) so cookies are first-party; CSRF double-submit if cookie auth, else short-lived bearer tokens.
- **Rate limiting:** Redis token bucket — strict on `/patch/query`, `/assessment-attempts/*/submit`, auth-adjacent routes.
- **Data protection:** RDS encryption at rest, KMS-signed credentials, PII minimized (profile answers are pseudonymous by design), 30-day soft-delete + GDPR export/erase endpoints for user data.
- **Secrets:** AWS Secrets Manager; no secrets in env files committed to git.

---

## 9. Patch AI assistant & analytics

**Patch (RAG, course-scoped)**
- Ingest: published content bundles → chunk by sub-module/beat → embeddings (e.g., OpenAI `text-embedding-3-small` or a self-hosted model) → pgvector.
- Retrieval: hybrid (keyword trigram + vector similarity), hard-scoped to the enrolled course's content version — the current KB's "scope guard" becomes a retrieval filter, not a keyword list.
- Generation: LLM answers **only from retrieved chunks**, must return citations (module/sub-module); below a similarity floor it says "that's outside this course" — preserving the existing product promise.
- Cache: Redis answer cache keyed on (content version, normalized question); every exchange stored in `patch_messages` for quality review.
- Fallback: the deterministic keyword KB (`knowledgeBase.js`) ships server-side as the offline/degraded path.

**Analytics & instructor dashboards**
- `progress_events` + `signals` are the event stream. Nightly rollup worker → warehouse tables (Athena over S3 exports is the cheapest AWS path; BigQuery equivalent on GCP).
- Dashboards (QuickSight/Metabase + a few `/admin/analytics` endpoints):
  - cohort funnel (started → module N → final → certified), time-per-stage,
  - item analysis (p-values, flag discrimination < 0.2),
  - adaptation efficacy (support level vs. completion), at-risk flags (stalled > N days),
  - Patch: unanswered questions → content-gap report fed back to authoring.

---

## 10. Cloud infrastructure (AWS reference)

| Concern | Choice | GCP / Azure mapping |
|---|---|---|
| Compute | ECS Fargate (api, worker) | Cloud Run / Container Apps |
| DB | RDS Postgres 16 + pgvector (Multi-AZ) | Cloud SQL / Azure PG |
| Cache | ElastiCache Redis | Memorystore |
| Static/CDN | S3 + CloudFront | GCS + CDN / Blob + Front Door |
| Auth | Cognito (OIDC) | Firebase Auth / Entra External ID |
| Secrets | Secrets Manager + KMS | Secret Manager / Key Vault |
| Warehouse | S3 + Athena + QuickSight | BigQuery + Looker Studio |
| IaC | Terraform | same |

- **Environments:** dev / staging / prod, same Terraform modules, separate AWS accounts.
- **Sizing (v1):** api: 2×0.5 vCPU/1 GB tasks autoscaled 2–6; RDS db.t4g.medium Multi-AZ; total ≈ **$250–450/month** at pilot scale.
- **CI/CD:** GitHub Actions → ruff + mypy + pytest (≥85% on `adaptive`/`assessment` modules) → docker build → ECR → staged ECS deploy (staging auto, prod gated) → Alembic migrations run as a task before rollout.
- **Observability:** OpenTelemetry traces → X-Ray/Datadog, structured JSON logs, Sentry, `/healthz` (liveness) + `/readyz` (DB/Redis checks), alarms on 5xx rate, p95 latency, DLQ depth.
- **DR:** automated RDS snapshots (7-day PITR), S3 versioning, documented restore drill quarterly. RPO 5 min / RTO 1 h targets.

---

## 11. Client integration plan (the SPA)

1. **API client module** (`src/api/`): typed fetch wrapper, auth token handling, retry with backoff.
2. **Sync engine:** Zustand stores gain an `origin: 'local' | 'server'` flag. In connected mode, store mutations enqueue events (`client_event_id` = UUID) and a background flusher posts batches every ~5 s / on page-hide. Failed batches persist — the existing localStorage persistence becomes the offline queue for free.
3. **Assessment pages** swap local answer keys for attempt/submit endpoints (the current `final.questions` in the bundle is stripped of `correct`/`explain` when connected).
4. **Demo mode** (toggle in Profile) bypasses the API entirely — exactly today's behavior, so sales demos never need accounts or network.
5. **Migration safety:** a one-time `POST /v1/me/import` endpoint ingests a learner's localStorage snapshot so existing demo data converts into a real account.

---

## 12. Delivery roadmap

| Phase | Scope | Outcome | Rough effort |
|---|---|---|---|
| **0 — Foundations** | Repo scaffold (FastAPI + Alembic + Docker + Terraform), CI, OIDC auth, `/v1/me` | Deployable skeleton behind auth | 1–2 wks |
| **1 — Learning core** | Enrollments, profile, precheck, progress events + projection, plan endpoint, client sync engine | Multi-device progress for real accounts | 2–3 wks |
| **2 — Assessment & credentials** | Attempt/submit APIs, server-side scoring, signed credentials + verification | Answer keys leave the client; verifiable certificates | 2 wks |
| **3 — Content pipeline** | Content schema, CI validators, publish API, version pinning | Content-as-code, safe mid-cohort updates | 1–2 wks |
| **4 — Patch RAG** | Ingestion, pgvector retrieval, guarded generation, caching, logging | Real course-scoped assistant | 2–3 wks |
| **5 — Analytics** | Warehouse rollups, instructor endpoints, dashboards, item analysis | Instructor visibility + at-risk flags | 2 wks |
| **6 — Hardening** | Load tests, pen-test fixes, backup/restore drill, runbooks, GDPR endpoints | Production sign-off | 1–2 wks |

Total: roughly **11–16 weeks** for one backend engineer (2) + part-time frontend support; Phases 0–2 alone make the product demoable with real accounts.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Adaptive parity drift between JS demo mode and Python server rules | Golden-master tests: identical fixtures must produce identical plans in both implementations; CI runs them on every change to either |
| LLM answers drift outside course scope | Retrieval-only grounding + similarity floor + citation requirement + stored transcripts for audit; deterministic KB as fallback |
| Content updates breaking in-flight learners | Per-enrollment content version pinning; bundles immutable |
| Event replay/duplication from offline client | `client_event_id` idempotency, monotonic first-completion semantics, server-side timestamps for truth |
| Solo Postgres dependency (incl. vectors) | pgvector covers pilot scale; migration path to a dedicated vector store documented (Qdrant/OpenSearch) if >10M chunks or latency SLOs slip |
