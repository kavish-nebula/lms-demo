"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  Accessibility,
  ArrowRight,
  BookMarked,
  BookOpen,
  Bot,
  Briefcase,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  Code2,
  FolderKanban,
  Gauge,
  GraduationCap,
  ListOrdered,
  MessageSquareQuote,
  Quote,
  RotateCcw,
  SendHorizontal,
  SkipForward,
  Sparkles,
  Target,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineDiagram } from "@/components/kit/pipeline";
import { AssistantAvatar, type PipReaction } from "@/components/learning/assistant-avatar";
import { api } from "@/lib/api";
import { applyFieldAccent, FIELD_ACCENTS, type FieldAccent } from "@/lib/field-accent";
import { FIELD_GROUPS, type FieldGroup } from "@/lib/field-group";
import type { InterviewTurn, SetupAnswers } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import type { Pipeline } from "@/data/types";

type Option = { label: string; value: string; kind?: string };
type Question = { slot: string; q: string; options: Option[]; multi?: boolean; source: "ai" | "rules" };
type Progress = { answered: number; remaining: number };
export type InterviewState = { answers: SetupAnswers; needs: string[]; derived: ProfileDerived | null; ack: string | null; question: Question | null; done: boolean; progress?: Progress };
type Last = { slot: string; q: string; value?: string | string[]; label?: string; text?: string; kind?: string; skipped?: boolean };

/** The course's own support story as a tiny workflow: what they will build. */
const DEMO: Pipeline = {
  nodes: [
    { id: "ask", kind: "trigger", label: "Customer asks", sub: "Where is my order?", x: 0, y: 40, state: "ok" },
    { id: "agent", kind: "logic", label: "Scout reads it", sub: "Agent decides", x: 210, y: 40, state: "ok" },
    { id: "tool", kind: "http", label: "track_parcel", sub: "Tool call", x: 420, y: 0, state: "running" },
    { id: "reply", kind: "action", label: "Reply sent", sub: "With the real status", x: 420, y: 90, state: "idle" },
  ],
  edges: [
    { id: "a", source: "ask", target: "agent", state: "ok" },
    { id: "b", source: "agent", target: "tool", state: "running" },
    { id: "c", source: "agent", target: "reply", state: "idle" },
  ],
};

/** Each fact Pip asks about, as the learner sees it in "Your profile". Follow-ups and unknown slots fall back to the question. */
const SLOT_ICON = {
  domain: Briefcase,
  role: UserRound,
  years: CalendarClock,
  tools: Wrench,
  coding: Code2,
  style: BookOpen,
  firstStep: ListOrdered,
  needs: Accessibility,
  studyLevel: GraduationCap,
  studyField: BookMarked,
  project: FolderKanban,
  goal: Target,
  experience: Gauge,
  firstJob: Bot,
  known: CheckCheck,
  expect: MessageSquareQuote,
} satisfies Record<string, LucideIcon>;
type SlotKey = keyof typeof SLOT_ICON;
const isSlotKey = (slot: string): slot is SlotKey => slot in SLOT_ICON;
const SKIPPED = "(skipped)";

/** The learner's field as Pip's quote group and the app's accent colour. */
function fieldLook(a: SetupAnswers): { group: FieldGroup | null; accent: FieldAccent | null } {
  const key = a.domain === "other" ? (a.field ?? "other") : a.domain;
  return {
    group: key && (FIELD_GROUPS as readonly string[]).includes(key) ? (key as FieldGroup) : null,
    accent: key && (FIELD_ACCENTS as readonly string[]).includes(key) ? (key as FieldAccent) : null,
  };
}

/**
 * Pip's interview, in two places:
 *  - "About you", after signing in (no `course`): the learner types the field
 *    they work or study in; every question after that is written by the
 *    language model on the server for this learner (POST /api/v1/profiling/turn).
 *    Progress is saved each turn, so it resumes; "Start again" clears it.
 *  - Enrolling in a course (`course` given): four or five questions about this
 *    course only, what they want from it, what they already know of it
 *    (POST /api/v1/courses/:id/fit). The profile is not asked again, and
 *    nothing is stored until the enrolment is saved.
 * Either way the learner taps an answer (or presses its number) or types
 * their own, and Pip reacts. Beside the chat, "Your profile" fills in as they
 * answer, so they can see what Pip has understood and how much is left.
 */
export function InterviewChat({
  name,
  initial,
  continueLabel,
  onDone,
  course,
}: {
  name: string;
  initial: Pick<InterviewState, "answers" | "needs" | "derived">;
  continueLabel: string;
  onDone: (s: Pick<InterviewState, "answers" | "needs" | "derived">) => void;
  course?: { id: string; title: string };
}) {
  const t = useTranslations("enroll");
  const key = course ? "courseInterview" : "interview";
  const [state, setState] = React.useState<InterviewState>({ ...initial, ack: null, question: null, done: false });
  const [started, setStarted] = React.useState(() => !!course || !!initial.answers.interview?.length);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState<Last | null | false>(false);
  const [draft, setDraft] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [acks, setAcks] = React.useState<Record<number, string>>({});
  const [reaction, setReaction] = React.useState<PipReaction>("wave");
  const [confirmRestart, setConfirmRestart] = React.useState(false);
  const logRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const turns = state.answers[key] ?? [];
  const asksField = !course && started && !turns.length && !loading;
  const q = !loading && failed === false ? state.question : null;

  React.useEffect(() => {
    // Pip is right here, so the floating help launcher steps aside (learning.css)
    document.documentElement.dataset.pipChat = "";
    return () => {
      delete document.documentElement.dataset.pipChat;
    };
  }, []);

  // keep the newest message in view (straight there on opening, smoothly after), and put focus where the next answer goes
  const scrolled = React.useRef(false);
  React.useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const frame = requestAnimationFrame(() => {
      log.scrollTo({ top: log.scrollHeight, behavior: scrolled.current ? "smooth" : "auto" });
      scrolled.current = true;
      if (asksField) inputRef.current?.focus({ preventScroll: true });
      else log.querySelector<HTMLElement>("[data-chip]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [turns.length, state.question, loading, asksField, state.done]);

  const send = React.useCallback(
    async (last: Last | null) => {
      setLoading(true);
      setFailed(false);
      setReaction("think");
      setConfirmRestart(false);
      try {
        const { interview } = await api<{ interview: InterviewState }>(course ? `/api/v1/courses/${course.id}/fit` : "/api/v1/profiling/turn", {
          method: "POST",
          body: course ? { answers: state.answers, last } : { answers: state.answers, needs: state.needs, last },
        });
        const answered = (interview.answers[key] ?? []).length;
        if (interview.ack && last) setAcks((a) => ({ ...a, [answered - 1]: interview.ack! }));
        setState(interview);
        setDraft("");
        setPicked([]);
        setReaction(interview.done || last?.slot === "domain" ? "celebrate" : "point");
        if (last?.slot === "domain") applyFieldAccent(fieldLook(interview.answers).accent);
      } catch {
        setFailed(last);
        setReaction("idle");
      } finally {
        setLoading(false);
      }
    },
    [state.answers, state.needs, course, key],
  );

  // resuming a conversation, or opening a course's questions: ask for the next question
  const resumed = React.useRef(false);
  React.useEffect(() => {
    if (resumed.current || (!course && !initial.answers.interview?.length)) return;
    resumed.current = true;
    void send(null);
  }, [initial.answers.interview, course, send]);

  const answer = React.useCallback(
    (o: Option) => {
      if (q) void send({ slot: q.slot, q: q.q, value: o.value, label: o.label, ...(o.kind ? { kind: o.kind } : {}) });
    },
    [q, send],
  );
  const submitPicked = React.useCallback(() => {
    if (!q || !picked.length) return;
    void send({ slot: q.slot, q: q.q, value: picked, label: q.options.filter((o) => picked.includes(o.value)).map((o) => o.label).join(", ") });
  }, [q, picked, send]);
  const toggle = React.useCallback((v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])), []);

  // number keys pick an answer (1–9), Enter sends several; never while typing
  React.useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, [contenteditable]")) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, q.options.length)) {
        e.preventDefault();
        const o = q.options[n - 1]!;
        if (q.multi) toggle(o.value);
        else answer(o);
      } else if (e.key === "Enter" && q.multi && picked.length && !el?.closest("button")) {
        e.preventDefault();
        submitPicked();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, picked, answer, toggle, submitPicked]);

  const submitText = () => {
    const text = draft.trim();
    if (!text) return;
    if (asksField) void send({ slot: "domain", q: t("interviewFieldQ"), text });
    else if (q) void send({ slot: q.slot, q: q.q, text, label: text });
  };

  const restart = async () => {
    setConfirmRestart(false);
    setAcks({});
    setDraft("");
    setPicked([]);
    setFailed(false);
    if (course) {
      // the course answers live only here until the enrolment is saved
      setState((s) => ({ ...s, answers: {}, ack: null, question: null, done: false, progress: undefined }));
      resumed.current = true;
      setLoading(true);
      setReaction("think");
      try {
        const { interview } = await api<{ interview: InterviewState }>(`/api/v1/courses/${course.id}/fit`, { method: "POST", body: { answers: {}, last: null } });
        setState(interview);
        setReaction("point");
      } catch {
        setFailed(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    await api("/api/v1/profiling", { method: "DELETE" }).catch(() => undefined);
    applyFieldAccent(null);
    setState({ answers: {}, needs: [], derived: null, ack: null, question: null, done: false });
    setStarted(true);
    setReaction("wave");
  };

  const look = fieldLook(state.answers);
  // a resumed "About you" keeps the colour of the field already given
  const resumedAccent = React.useRef(false);
  React.useEffect(() => {
    if (course || resumedAccent.current || !look.accent) return;
    resumedAccent.current = true;
    applyFieldAccent(look.accent);
  }, [course, look.accent]);
  const answered = state.progress?.answered ?? turns.length;
  const remaining = state.done ? 0 : Math.max(state.progress?.remaining ?? (course ? 5 : 9) - turns.length, 0);
  const total = Math.max(answered + remaining, 1);
  const pct = state.done ? 100 : Math.round((answered / total) * 100);
  const status = loading
    ? t("chatStatusThinking")
    : state.done
      ? t("chatStatusDone")
      : started
        ? t("chatStatusAsking", { n: Math.min(answered + 1, total), total })
        : t("chatStatusReady");
  const composerOpen = !loading && (asksField || !!q);
  const thinkingText = turns.length || course ? t("interviewThinking") : t("chatReadingField");

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ------------------------------------------------ the conversation */}
      <section
        aria-label={t("chatLog")}
        className="flex h-[calc(100dvh-var(--nav-h)-3rem)] min-h-[520px] flex-col overflow-hidden rounded-(--r-xl) border border-line bg-panel/80 shadow-(--shadow-md) backdrop-blur-md lg:h-[calc(100dvh-var(--nav-h)-5rem)]"
      >
        <header className="relative flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <AssistantAvatar className="size-11" reaction={reaction} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Pip</span>
              <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">{course ? t("fitBadge") : t("chatRole")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", loading ? "animate-pulse bg-brand" : "bg-ok")} />
              <span className="truncate">{status}</span>
            </div>
          </div>
          {turns.length ? (
            confirmRestart ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden text-sm text-ink-muted sm:inline">{t("interviewRestartAsk")}</span>
                <Button size="sm" variant="outline" onClick={() => void restart()}>
                  {t("interviewRestartYes")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRestart(false)}>
                  {t("interviewRestartNo")}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-ink-muted" aria-label={t("interviewRestart")} onClick={() => setConfirmRestart(true)}>
                <RotateCcw data-icon="inline-start" />
                <span className="hidden sm:inline">{t("interviewRestart")}</span>
              </Button>
            )
          ) : null}
          {/* progress along the bottom edge of the header */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line" role="progressbar" aria-label={t("chatProgressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <motion.div className={cn("h-full", state.done ? "bg-ok" : "bg-brand")} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
        </header>

        <div ref={logRef} role="log" aria-live="polite" aria-busy={loading} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6">
          <PipSays avatar>
            <strong className="block">{course ? t("fitHello", { name, course: course.title }) : t("chatHello", { name })}</strong>
            <span className="text-ink-muted">{course ? t("fitHonest") : t("chatHonest")}</span>
          </PipSays>

          {!started ? <Welcome onStart={() => setStarted(true)} /> : null}

          {turns.map((turn, i) => (
            <React.Fragment key={i}>
              <PipSays avatar>{turn.q}</PipSays>
              <YouSaid skipped={turn.a === SKIPPED}>{turn.a === SKIPPED ? t("chatSkipped") : turn.a}</YouSaid>
              {i === 0 && !course && look.group ? (
                <motion.figure
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative overflow-hidden rounded-(--r-lg) border border-brand-line bg-gradient-to-br from-brand-soft to-panel px-5 py-4 sm:ml-10 sm:max-w-[85%]"
                >
                  <Quote aria-hidden className="absolute -top-1 right-3 size-14 text-brand/15" />
                  <blockquote className="relative text-lg font-semibold tracking-tight">“{t(`pipQuote_${look.group}`)}”</blockquote>
                  <figcaption className="relative mt-1 text-xs text-ink-muted">{t("chatQuoteFor")}</figcaption>
                </motion.figure>
              ) : null}
              {acks[i] ? (
                <PipSays muted>
                  <Sparkles aria-hidden className="mr-1.5 inline size-3.5 text-brand-ink" />
                  {acks[i]}
                </PipSays>
              ) : null}
            </React.Fragment>
          ))}

          {asksField ? (
            <PipSays avatar strong>
              <span className="text-[1.05rem] font-semibold">{t("interviewFieldQ")}</span>
              <span className="mt-1 block text-sm text-ink-muted">{t("chatFieldHelp")}</span>
            </PipSays>
          ) : null}

          <AnimatePresence>
            {loading ? (
              <motion.div key="typing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <AssistantAvatar className="size-8" reaction="think" />
                <div className="rounded-2xl rounded-bl-md border border-line bg-panel-2 px-4 py-3.5">
                  <span className="typing-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="sr-only">{thinkingText}</span>
                </div>
                <span className="pb-2.5 text-xs text-ink-faint" aria-hidden>
                  {thinkingText}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {failed !== false && !loading ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-err-line bg-err-soft px-4 py-3 text-sm sm:ml-10 sm:max-w-[85%]">
              {t("interviewFailed")}
              <Button size="sm" variant="outline" onClick={() => void send(failed)}>
                <RotateCcw data-icon="inline-start" />
                {t("interviewRetry")}
              </Button>
            </div>
          ) : null}

          {q ? (
            <div key={`${q.slot}-${turns.length}`} className="flex flex-col gap-3">
              <PipSays avatar strong>
                <span className="mb-1 block text-xs font-semibold tracking-wide text-brand-ink uppercase">{t("chatQuestionN", { n: Math.min(answered + 1, total), total })}</span>
                <span id="interview-q" className="text-[1.05rem] font-semibold">
                  {q.q}
                </span>
                {q.multi ? <span className="mt-1 block text-sm text-ink-muted">{t("pickAny")}</span> : null}
              </PipSays>
              <div role={q.multi ? "group" : "radiogroup"} aria-labelledby="interview-q" className="grid gap-2 sm:ml-10 sm:grid-cols-2">
                {q.options.map((o, i) => {
                  const on = picked.includes(o.value);
                  return (
                    <motion.button
                      key={o.value + o.label}
                      type="button"
                      data-chip
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.2 }}
                      role={q.multi ? undefined : "radio"}
                      aria-checked={q.multi ? undefined : false}
                      aria-pressed={q.multi ? on : undefined}
                      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                      onClick={() => (q.multi ? toggle(o.value) : answer(o))}
                      className={cn(
                        "group flex min-h-12 items-center gap-3 rounded-(--r) border px-3 py-2.5 text-left font-medium outline-none transition-[border-color,background-color,box-shadow] duration-(--dur-1) focus-visible:ring-2 focus-visible:ring-ring/60",
                        on ? "border-brand bg-brand-soft text-brand-ink shadow-(--shadow-sm)" : "border-line bg-panel hover:border-brand-line hover:bg-brand-soft/50 hover:shadow-(--shadow-sm)",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-(--r-xs) border font-mono text-xs transition-colors duration-(--dur-1)",
                          on ? "border-brand bg-brand text-on-brand" : "border-line bg-panel-2 text-ink-muted group-hover:border-brand-line group-hover:text-brand-ink",
                        )}
                      >
                        {on ? <Check className="size-3.5" /> : i < 9 ? i + 1 : "•"}
                      </span>
                      <span className="min-w-0 flex-1">{o.label}</span>
                      {!q.multi ? (
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-faint opacity-0 transition-opacity duration-(--dur-1) group-hover:opacity-100 group-focus-visible:opacity-100" />
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
              {q.multi ? (
                <div className="flex justify-end">
                  <Button variant="brand" disabled={!picked.length} onClick={submitPicked}>
                    <Check data-icon="inline-start" />
                    {picked.length ? t("chatDoneN", { n: picked.length }) : t("chatDone")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {state.done && turns.length && !loading ? <Finished turns={turns} course={!!course} continueLabel={continueLabel} onContinue={() => onDone(state)} /> : null}
        </div>

        {/* ------------------------------------------------ composer */}
        {composerOpen ? (
          <form
            className="flex flex-col gap-2 border-t border-line bg-panel-2/40 px-4 py-3 sm:px-5"
            onSubmit={(e) => {
              e.preventDefault();
              submitText();
            }}
          >
            <div className="flex items-center gap-2">
              {q ? (
                <Button type="button" variant="ghost" size="sm" className="shrink-0 text-ink-muted" onClick={() => void send({ slot: q.slot, q: q.q, skipped: true })}>
                  <SkipForward data-icon="inline-start" />
                  {t("chatSkip")}
                </Button>
              ) : null}
              <label htmlFor="interview-text" className="sr-only">
                {asksField ? t("interviewFieldQ") : t("interviewOwnWords")}
              </label>
              <Input
                ref={inputRef}
                id="interview-text"
                maxLength={asksField ? 80 : 160}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={asksField ? t("interviewFieldPlaceholder") : t("interviewOwnWordsLong")}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-pill bg-panel px-4"
              />
              <Button type="submit" variant="brand" size="icon" className="size-11 shrink-0 rounded-full" disabled={!draft.trim()} aria-label={t("chatSend")}>
                <SendHorizontal />
              </Button>
            </div>
            <p className="hidden text-xs text-ink-faint md:block">{q ? t("chatKeysHint", { n: Math.min(9, q.options.length) }) : t("chatFieldHint")}</p>
          </form>
        ) : null}
      </section>

      {/* ------------------------------------------------ what Pip has understood */}
      <ProfilePanel turns={turns} remaining={started ? remaining : 0} pct={pct} answered={answered} total={total} course={course?.title} done={state.done} />
    </div>
  );
}

/** Before the first question: what they'll build, and what Pip will ask. */
function Welcome({ onStart }: { onStart: () => void }) {
  const t = useTranslations("enroll");
  const steps: { icon: LucideIcon; label: string }[] = [
    { icon: Briefcase, label: t("chatPlanField") },
    { icon: Wrench, label: t("chatPlanWork") },
    { icon: BookOpen, label: t("chatPlanLearn") },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 rounded-(--r-lg) border border-brand-line bg-panel p-4 sm:ml-10 sm:p-5">
      <div>
        <div className="font-semibold">{t("chatDemoTitle")}</div>
        <p className="mt-1 text-sm text-ink-muted">{t("chatDemoBody")}</p>
      </div>
      <div className="overflow-x-auto rounded-(--r) border border-line bg-panel-2/50 p-3">
        <PipelineDiagram pipeline={DEMO} label={t("chatDemoLabel")} center />
      </div>
      <div>
        <div className="text-sm font-semibold">{t("chatPlanTitle")}</div>
        <ol className="mt-2 grid gap-2 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2.5 rounded-(--r) border border-line bg-panel-2/40 px-3 py-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <s.icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="sr-only">{i + 1}. </span>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="brand" size="lg" onClick={onStart}>
          {t("chatStart")}
          <ArrowRight data-icon="inline-end" />
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <Clock3 className="size-4" aria-hidden />
          {t("chatTime")}
        </span>
      </div>
    </motion.div>
  );
}

/** The end of the conversation: what Pip heard, and the way on. */
function Finished({ turns, course, continueLabel, onContinue }: { turns: InterviewTurn[]; course: boolean; continueLabel: string; onContinue: () => void }) {
  const t = useTranslations("enroll");
  const heard = turns.filter((x) => x.a !== SKIPPED).slice(0, 8);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      className="flex flex-col gap-4 rounded-(--r-lg) border border-ok-line bg-ok-soft p-5 sm:ml-10"
    >
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok text-on-ok"
        >
          <Check className="size-5" aria-hidden />
        </motion.span>
        <div>
          <div className="font-semibold">{course ? t("fitAllDoneTitle") : t("chatAllDoneTitle")}</div>
          <div className="text-sm text-ink-muted">{course ? t("fitAllDone") : t("chatAllDone")}</div>
        </div>
      </div>
      {heard.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("chatHeard")}>
          {heard.map((x, i) => (
            <li key={i} className="max-w-full truncate rounded-pill border border-line bg-panel px-3 py-1 text-sm">
              {x.a}
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="brand" size="lg" className="self-start" onClick={onContinue}>
        {continueLabel}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </motion.div>
  );
}

/** "Your profile": each answer as it lands, then the questions still to come. */
function ProfilePanel({
  turns,
  remaining,
  pct,
  answered,
  total,
  course,
  done,
}: {
  turns: InterviewTurn[];
  remaining: number;
  pct: number;
  answered: number;
  total: number;
  course?: string;
  done: boolean;
}) {
  const t = useTranslations("enroll");
  const r = 22;
  const c = 2 * Math.PI * r;
  const title = course ? t("panelCourseTitle") : t("profilePanelTitle");
  return (
    <aside
      aria-label={title}
      className="hidden flex-col gap-4 rounded-(--r-xl) border border-line bg-panel/80 p-5 shadow-(--shadow-sm) backdrop-blur-md lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:flex"
    >
      <div className="flex items-center gap-4">
        <div className="relative size-14 shrink-0">
          <svg viewBox="0 0 52 52" className="size-14 -rotate-90" aria-hidden>
            <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
            <motion.circle
              cx="26"
              cy="26"
              r={r}
              fill="none"
              stroke={done ? "var(--ok)" : "var(--accent)"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={false}
              animate={{ strokeDashoffset: c - (c * pct) / 100 }}
              transition={{ type: "spring", stiffness: 90, damping: 20 }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{done ? <Check className="size-5 text-ok" aria-hidden /> : `${pct}%`}</span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="truncate text-sm text-ink-muted">{done ? t("panelDone") : course ? course : t("panelCount", { n: answered, total })}</div>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {turns.map((turn, i) => (
            <motion.li
              key={`${turn.slot}-${i}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 rounded-(--r) px-2 py-1.5 transition-colors duration-(--dur-1) hover:bg-panel-2/60"
            >
              <SlotIcon slot={turn.slot} skipped={turn.a === SKIPPED} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-ink-faint">{isSlotKey(turn.slot) ? t(`slot_${turn.slot}`) : turn.q}</div>
                <div className={cn("truncate text-sm font-medium", turn.a === SKIPPED && "font-normal text-ink-faint italic")} title={turn.a}>
                  {turn.a === SKIPPED ? t("chatSkipped") : turn.a}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {Array.from({ length: Math.min(remaining, 6) }, (_, i) => (
          <li key={`todo-${i}`} className="flex items-center gap-2.5 px-2 py-1.5" aria-hidden={i > 0 || undefined}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-line" />
            <span className={cn("h-2.5 flex-1 rounded-pill bg-panel-2", i === 0 && "animate-pulse")} />
            {i === 0 ? <span className="sr-only">{t("panelLeft", { n: remaining })}</span> : null}
          </li>
        ))}
      </ul>

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">{course ? t("panelCourseNote") : t("panelNote")}</p>
    </aside>
  );
}

function SlotIcon({ slot, skipped }: { slot: string; skipped: boolean }) {
  const Icon = isSlotKey(slot) ? SLOT_ICON[slot] : Sparkles;
  return (
    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", skipped ? "bg-panel-2 text-ink-faint" : "bg-brand-soft text-brand-ink")}>
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

/** One of Pip's messages; `avatar` starts a new turn with Pip's badge beside it. */
function PipSays({ muted, avatar, strong, children }: { muted?: boolean; avatar?: boolean; strong?: boolean; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="flex items-end gap-2">
      {avatar ? <AssistantAvatar className="size-8" /> : <span className="w-8 shrink-0" aria-hidden />}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-3",
          muted ? "border-transparent bg-panel-2/60 text-sm text-ink-muted" : strong ? "border-brand-line bg-panel shadow-(--shadow-sm)" : "border-line bg-panel-2",
        )}
      >
        <span className="sr-only">Pip: </span>
        {children}
      </div>
    </motion.div>
  );
}

function YouSaid({ skipped, children }: { skipped?: boolean; children: React.ReactNode }) {
  const t = useTranslations("enroll");
  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex justify-end">
      <div className={cn("max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5", skipped ? "border border-dashed border-line text-ink-muted italic" : "bg-brand text-on-brand shadow-(--shadow-sm)")}>
        <span className="sr-only">{t("interviewYou")}: </span>
        {children}
      </div>
    </motion.div>
  );
}
