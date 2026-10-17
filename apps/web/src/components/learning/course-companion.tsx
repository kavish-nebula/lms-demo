"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, BookOpen, Check, Compass, Download, Lightbulb, MessageCircle, NotebookPen, ShieldCheck, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AssistantAvatar, type PipReaction } from "./assistant-avatar";
import { companionNudge, companionReply, quickReply, PHASE_GUIDANCE, RESTRICTED_PHASES, type CompanionAnswer, type CompanionCourse, type CompanionStep, type CoursePassage } from "@/lib/companion";
import { api, ApiRequestError } from "@/lib/api";
import { courseLabel } from "@/lib/course-labels";
import { useLearning } from "@/lib/learning-state";
import { exportNotesPdf } from "@/lib/notes-pdf";
import "./learning.css";

type Context = { courseId: string; moduleId: string; phase: string; setStep: (step: CompanionStep) => () => void };
const LearningContext = React.createContext<Context | null>(null);
export function useLearningContext() { return React.useContext(LearningContext); }
export function useCompanionStep(step: CompanionStep) {
  const ctx = useLearningContext();
  const setStep = ctx?.setStep;
  React.useEffect(() => setStep?.({ title: step.title, guidance: step.guidance, hint: step.hint, phase: step.phase, videoId: step.videoId, slideTitle: step.slideTitle }), [setStep, step.title, step.guidance, step.hint, step.phase, step.videoId, step.slideTitle]);
}
export function askPip(question = "What should I do here?") {
  window.dispatchEvent(new CustomEvent("pip:ask", { detail: question }));
}
export function reactPip(reaction: PipReaction, message?: string) {
  window.dispatchEvent(new CustomEvent("pip:react", { detail: { reaction, message } }));
}
export function openPipNotes() {
  window.dispatchEvent(new Event("pip:notes"));
}

export function CourseCompanionProvider({ catalog, children }: { catalog: CompanionCourse[]; children: React.ReactNode }) {
  const path = usePathname();
  const pieces = path.split("/");
  const courseId = pieces[2] === "courses" ? pieces[3] ?? "" : "";
  const selected = catalog.find((c) => c.course.course_id === courseId);
  const moduleId = selected?.course.modules.find((m) => m.module_id === pieces[4])?.module_id ?? "";
  const phase = pieces[4] === "enroll" ? "profile" : pieces[4] === "finale" ? pieces[5] ?? "capstone" : pieces[5] ?? "course";
  const [active, setActive] = React.useState<{ path: string; step: CompanionStep } | null>(null);
  const setStep = React.useCallback((step: CompanionStep) => {
    const entry = { path, step };
    setActive(entry);
    return () => setActive((current) => current === entry ? null : current);
  }, [path]);
  const step = active?.path === path ? active.step : undefined;
  const currentPhase = step?.phase ?? phase;
  const value = React.useMemo(() => ({ courseId, moduleId, phase: currentPhase, setStep }), [courseId, moduleId, currentPhase, setStep]);
  return <LearningContext.Provider value={value}>
    {children}
    {selected && <Companion key={courseId} data={selected} moduleId={moduleId} phase={currentPhase} step={step} />}
  </LearningContext.Provider>;
}

type Message = { role: "user" | "assistant"; text: string; source?: Pick<CoursePassage, "title" | "href"> };
/** Turns sent with each question so follow-ups ("and why?") make sense; the server caps it at 8 too. */
const HISTORY = 8;
/** One-tap questions for an empty conversation; the first two are answered at once from the step itself. */
const STARTERS = [
  { text: "What should I do next?", icon: Compass },
  { text: "Give me a hint", icon: Lightbulb },
  { text: "What's the key idea here?", icon: Sparkles },
  { text: "Explain it with an example", icon: BookOpen },
];
function Companion({ data, moduleId, phase, step }: { data: CompanionCourse; moduleId: string; phase: string; step?: CompanionStep }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"chat" | "notes">("chat");
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [saved, setSaved] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");
  // the launcher greets once on arrival, then settles
  const [reaction, setReaction] = React.useState<PipReaction>("wave");
  const [reactionText, setReactionText] = React.useState("Ready when you are!");
  const [waiting, setWaiting] = React.useState(false);
  const { state, update } = useLearning(data.course.course_id);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const reactionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = React.useRef<Message[]>([]);
  React.useEffect(() => { messagesRef.current = messages; }, [messages]);
  /** Bumped on unmount and each new question, so a late answer never lands in the wrong place. */
  const askId = React.useRef(0);
  const restricted = RESTRICTED_PHASES.includes(phase);
  const current = data.course.modules.find((candidate) => candidate.module_id === moduleId);
  const moduleTitle = current ? courseLabel(data.course.course_id, "modules", current.module_id, current.title) : undefined;
  const guidance = restricted ? PHASE_GUIDANCE[phase]! : step?.guidance || PHASE_GUIDANCE[phase] || PHASE_GUIDANCE.course!;
  const nudge = companionNudge({ phase, moduleTitle, stepTitle: step?.title });

  const showReaction = React.useCallback((next: PipReaction, message = "") => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReaction(next);
    setReactionText(message);
    reactionTimer.current = setTimeout(() => {
      setReaction("idle");
      setReactionText("");
    }, 2800);
  }, []);

  React.useEffect(() => () => {
    askId.current++;
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (answerTimer.current) clearTimeout(answerTimer.current);
  }, []);
  React.useEffect(() => {
    reactionTimer.current = setTimeout(() => {
      setReaction("idle");
      setReactionText("");
    }, 2800);
  }, []);

  // Quick buttons and assessment phases answer at once, here; anything else goes to the server, which keeps Pip to this course.
  const ask = React.useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, 600);
    if (!text) return;
    setInput("");
    const context = { phase, guidance, nextStep: nudge, hint: step?.hint, courseTitle: data.course.title, moduleId, videoId: step?.videoId, slideTitle: step?.slideTitle, passages: data.passages };
    const answer = (reply: CompanionAnswer) => setMessages((m) => [...m, { role: "assistant" as const, ...reply }].slice(-30));
    const history = messagesRef.current.slice(-HISTORY).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user" as const, text }].slice(-30));
    showReaction("think", "Let me check this step…");
    if (answerTimer.current) clearTimeout(answerTimer.current);

    const quick = quickReply(text, context);
    if (quick) {
      answerTimer.current = setTimeout(() => showReaction("point", "Here’s the key idea."), 850);
      answer(quick);
      return;
    }
    const id = ++askId.current;
    setWaiting(true);
    let reply: CompanionAnswer;
    try {
      reply = await api<CompanionAnswer>(`/api/v1/courses/${data.course.course_id}/companion`, {
        method: "POST",
        body: { message: text, phase, moduleId: moduleId || undefined, history, step: step && { title: step.title, guidance: step.guidance, hint: step.hint, videoId: step.videoId, slideTitle: step.slideTitle } },
      });
    } catch (e) {
      // offline or server trouble: the in-browser passage match still answers
      reply = e instanceof ApiRequestError && e.status === 429 ? { text: e.message } : companionReply(text, context);
    }
    if (id !== askId.current) return;
    setWaiting(false);
    showReaction("point", "Here’s the key idea.");
    answer(reply);
  }, [data, moduleId, phase, guidance, nudge, showReaction, step]);

  React.useEffect(() => {
    const onAsk = (event: Event) => { setOpen(true); setTab("chat"); ask((event as CustomEvent<string>).detail); };
    const onNotes = () => { setOpen(true); setTab(restricted ? "chat" : "notes"); };
    const onReact = (event: Event) => {
      const detail = (event as CustomEvent<{ reaction: PipReaction; message?: string }>).detail;
      if (detail?.reaction) showReaction(detail.reaction, detail.message);
    };
    window.addEventListener("pip:ask", onAsk);
    window.addEventListener("pip:notes", onNotes);
    window.addEventListener("pip:react", onReact);
    return () => {
      window.removeEventListener("pip:ask", onAsk);
      window.removeEventListener("pip:notes", onNotes);
      window.removeEventListener("pip:react", onReact);
    };
  }, [ask, restricted, showReaction]);
  React.useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, open, waiting]);
  React.useEffect(() => { if (open) window.dispatchEvent(new Event("pip:opened")); }, [open]);

  const close = () => setOpen(false);
  return <div className="pip-dock" data-phase={phase}>
    <button
      type="button"
      data-tour="pip"
      className={`pip-launcher pip-character-launcher ${open ? "invisible" : ""}`}
      aria-label="Open my assistant"
      aria-expanded={open}
      title="My Assistant"
      onClick={() => { setOpen(true); showReaction("wave", "How can I help?"); }}
    >
      {reactionText && !open ? <span className="pip-reaction-bubble" role="status" aria-live="polite">{reactionText}</span> : null}
      <AssistantAvatar className="pip-launcher-avatar" reaction={reaction} />
    </button>

    {/* My Assistant opens as a panel down the right side; the page stays visible and usable beside it (Esc or × closes it) */}
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        onInteractOutside={(e) => e.preventDefault()}
        side="right"
        showCloseButton={false}
        className="assistant-sheet gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[30rem]"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <AssistantAvatar className="size-10" reaction={waiting ? "think" : "idle"} />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base font-semibold">My Assistant</SheetTitle>
            <SheetDescription className="truncate text-xs text-ink-muted">{moduleTitle ? `Helping with ${moduleTitle}` : `Here for ${data.course.title}`}</SheetDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close my assistant" onClick={close}><X /></Button>
        </header>

        <div className="flex gap-1 border-b border-line px-5 py-2" role="group" aria-label="Assistant tools">
          <button id="pip-chat-tab" aria-controls="pip-chat-panel" aria-pressed={tab === "chat"} onClick={() => setTab("chat")} className="pip-tab"><MessageCircle className="size-4" />Chat</button>
          <button id="pip-notes-tab" aria-controls="pip-notes-panel" aria-pressed={tab === "notes"} onClick={() => setTab("notes")} className="pip-tab" disabled={restricted}><NotebookPen className="size-4" />My notes</button>
        </div>

        {restricted ? (
          <div className="flex flex-1 flex-col gap-2 p-5 text-sm leading-relaxed" role="status">
            <ShieldCheck className="size-6 text-brand-ink" />
            <strong className="text-base">Try this one yourself.</strong>
            {nudge}
          </div>
        ) : tab === "notes" ? (
          <div id="pip-notes-panel" role="region" aria-labelledby="pip-notes-tab" className="flex min-h-0 flex-1 flex-col gap-2 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="pip-notes" className="text-sm font-medium">My notes for this course</label>
              <Button variant="outline" size="sm" disabled={!state.notes.trim() || exporting} onClick={async () => {
                setExporting(true);
                setExportError("");
                try {
                  await exportNotesPdf({ courseTitle: data.course.title, notes: state.notes, date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) });
                } catch {
                  setExportError("Could not open the print preview. Please try again.");
                } finally {
                  setExporting(false);
                }
              }}><Download data-icon="inline-start" />{exporting ? "Opening…" : "Export to PDF"}</Button>
            </div>
            <textarea id="pip-notes" value={state.notes} onChange={(e) => update((s) => ({ ...s, notes: e.target.value.slice(0, 10000) }))} placeholder="An insight, a question, something to try…" className="pip-notes min-h-0 flex-1 resize-none" maxLength={10000} />
            <p className="text-xs text-ink-muted">Saved in this browser for this course.</p>
            <p className="text-xs text-ink-muted">To export, choose Save as PDF in the print dialog.</p>
            {exportError && <p role="alert" className="text-xs text-destructive">{exportError}</p>}
          </div>
        ) : (
          <>
            <div id="pip-chat-panel" role="region" aria-labelledby="pip-chat-tab" ref={listRef} className="assistant-messages">
              {messages.length ? null : (
                <div className="flex flex-col gap-4 pb-2">
                  <div>
                    <p className="text-xl font-semibold tracking-tight">How can I help you?</p>
                    <p className="mt-1 text-sm text-ink-muted">Ask any question about this course, or start with one of these.</p>
                  </div>
                  <div className="pip-bubble pip-nudge"><strong className="mb-1 block">Where you are</strong>{nudge}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {STARTERS.map((q) => (
                      <button key={q.text} type="button" onClick={() => ask(q.text)} disabled={waiting} className="assistant-starter">
                        <q.icon className="size-4 shrink-0 text-brand-ink" aria-hidden />
                        {q.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
                {messages.map((m, i) => <div key={i} className={`pip-bubble ${m.role === "user" ? "pip-user" : ""}`}>
                  <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>{m.text}
                  {m.source && <Link onClick={close} href={m.source.href} className="mt-3 flex items-start gap-2 text-xs text-brand-ink underline underline-offset-4"><BookOpen className="size-3.5 shrink-0" />{m.source.title}</Link>}
                </div>)}
                {waiting && <div className="pip-bubble pip-thinking" aria-busy="true"><span className="sr-only">The assistant is thinking</span><span aria-hidden="true">Thinking…</span></div>}
              </div>
              {messages.length ? (
                <div className="flex flex-wrap gap-2">{["Next step", "Hint"].map((q) => <button key={q} onClick={() => ask(q)} disabled={waiting} className="pip-suggestion"><Lightbulb className="size-3.5" />{q}</button>)}</div>
              ) : null}
            </div>
            {messages.at(-1)?.source && <button className="px-5 pb-2 text-left text-xs text-brand-ink" onClick={() => { const message = messages.at(-1)!; update((s) => ({ ...s, notes: `${s.notes}\n\n${message.text}\n${message.source?.title ?? ""}`.trim().slice(0, 10000) })); setSaved(true); }}><Check className="mr-1 inline size-3.5" />{saved ? "Added to my notes" : "Save this explanation to my notes"}</button>}
            <form className="pip-input" onSubmit={(e) => { e.preventDefault(); if (waiting) return; setSaved(false); ask(input); }}>
              <label htmlFor="pip-question" className="sr-only">Ask a question about this course</label>
              <input ref={inputRef} id="pip-question" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="Ask any question…" autoComplete="off" />
              <Button type="submit" variant="brand" size="icon-sm" disabled={!input.trim() || waiting} aria-label="Send question"><ArrowUp /></Button>
            </form>
            <p className="px-5 pb-4 text-[11px] text-ink-muted">Answers come from this course’s material.</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  </div>;
}
