"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, BookOpen, Check, Lightbulb, MessageCircle, NotebookPen, ShieldCheck, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PipMascot } from "./pip-mascot";
import { companionReply, PHASE_GUIDANCE, type CompanionCourse, type CompanionStep, type CoursePassage } from "@/lib/companion";
import { useLearning } from "@/lib/learning-state";
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
function Companion({ data, moduleId, phase, step }: { data: CompanionCourse; moduleId: string; phase: string; step?: CompanionStep }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"chat" | "notes">("chat");
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [saved, setSaved] = React.useState(false);
  const { state, update } = useLearning(data.course.course_id);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const restricted = ["gate", "final-check", "precheck"].includes(phase);
  const courseModule = data.course.modules.find((m) => m.module_id === moduleId);
  const guidance = restricted ? PHASE_GUIDANCE[phase]! : step?.guidance || PHASE_GUIDANCE[phase] || PHASE_GUIDANCE.course!;

  const ask = React.useCallback((raw: string) => {
    const text = raw.trim().slice(0, 600);
    if (!text) return;
    setInput("");
    const response: Message = { role: "assistant", ...companionReply(text, { phase, guidance, hint: step?.hint, courseTitle: data.course.title, moduleId, videoId: step?.videoId, slideTitle: step?.slideTitle, passages: data.passages }) };
    setMessages((m) => [...m, { role: "user" as const, text }, response].slice(-30));
  }, [data, moduleId, phase, guidance, step?.hint, step?.videoId, step?.slideTitle]);

  React.useEffect(() => {
    const onAsk = (event: Event) => { setOpen(true); setTab("chat"); ask((event as CustomEvent<string>).detail); };
    const onNotes = () => { setOpen(true); setTab(restricted ? "chat" : "notes"); };
    window.addEventListener("pip:ask", onAsk);
    window.addEventListener("pip:notes", onNotes);
    return () => {
      window.removeEventListener("pip:ask", onAsk);
      window.removeEventListener("pip:notes", onNotes);
    };
  }, [ask, restricted]);
  React.useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, open]);
  React.useEffect(() => { if (open) window.dispatchEvent(new Event("pip:opened")); }, [open]);

  return <div className="pip-dock" data-phase={phase}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="pip-launcher pip-character-launcher" aria-label="Ask Pip, your course companion" title="Ask Pip">
          <PipMascot className="pip-launcher-mascot" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="pip-panel p-0" onKeyDown={(e) => e.stopPropagation()} onEscapeKeyDown={(e) => e.stopPropagation()} onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <header className="pip-header">
          <PipMascot className="size-14" happy />
          <div className="min-w-0 flex-1"><h2 className="font-semibold">A little help from Pip</h2><p className="text-xs text-ink-muted">Here for your learning journey</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Close Pip" onClick={() => setOpen(false)}><X /></Button>
        </header>
        <div className="pip-context"><span className="pip-status-dot" />{step?.title || courseModule?.title || data.course.title}</div>
        <div className="flex gap-1 border-b border-line px-4 py-2" role="group" aria-label="Companion tools">
          <button id="pip-chat-tab" aria-controls="pip-chat-panel" aria-pressed={tab === "chat"} onClick={() => setTab("chat")} className="pip-tab"><MessageCircle className="size-4" />Guidance</button>
          <button id="pip-notes-tab" aria-controls="pip-notes-panel" aria-pressed={tab === "notes"} onClick={() => setTab("notes")} className="pip-tab" disabled={restricted}><NotebookPen className="size-4" />My notebook</button>
        </div>
        {restricted ? <div className="p-5 text-sm leading-relaxed" role="status"><ShieldCheck className="mb-3 size-6 text-brand-ink" /><strong className="block mb-2">You’ve got this. Try it independently.</strong>{guidance}<p className="mt-3 text-xs text-ink-muted">Your conversation and notes will be available again after you leave this check.</p></div> : tab === "notes" ?
          <div id="pip-notes-panel" role="region" aria-labelledby="pip-notes-tab" className="p-4">
            <label htmlFor="pip-notes" className="mb-2 block text-sm font-medium">Ideas to take with you</label>
            <textarea id="pip-notes" value={state.notes} onChange={(e) => update((s) => ({ ...s, notes: e.target.value.slice(0, 10000) }))} placeholder="An insight, a question, something to try…" className="pip-notes" rows={8} maxLength={10000} />
            <p className="mt-2 text-xs text-ink-muted">Saved in this browser for this course.</p>
          </div> : <>
            <div id="pip-chat-panel" role="region" aria-labelledby="pip-chat-tab" ref={listRef} className="pip-messages">
              <div className="pip-bubble"><strong className="block mb-1">Let’s take the next step together.</strong>{guidance}</div>
              <div className="flex flex-wrap gap-2">{["What should I do here?", "Give me a hint"].map((q) => <button key={q} onClick={() => ask(q)} className="pip-suggestion"><Lightbulb className="size-3.5" />{q}</button>)}</div>
              <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
                {messages.map((m, i) => <div key={i} className={`pip-bubble ${m.role === "user" ? "pip-user" : ""}`}>
                  <span className="sr-only">{m.role === "user" ? "You: " : "Pip: "}</span>{m.text}
                  {m.source && <Link onClick={() => setOpen(false)} href={m.source.href} className="mt-3 flex items-start gap-2 text-xs text-brand-ink underline underline-offset-4"><BookOpen className="size-3.5 shrink-0" />{m.source.title}</Link>}
                </div>)}
              </div>
            </div>
            {messages.at(-1)?.source && <button className="px-4 pb-2 text-left text-xs text-brand-ink" onClick={() => { const message = messages.at(-1)!; update((s) => ({ ...s, notes: `${s.notes}\n\n${message.text}\n${message.source?.title ?? ""}`.trim().slice(0, 10000) })); setSaved(true); }}><Check className="inline size-3.5 mr-1" />{saved ? "Added to your notebook" : "Save this explanation to my notebook"}</button>}
            <form className="pip-input" onSubmit={(e) => { e.preventDefault(); setSaved(false); ask(input); }}>
              <label htmlFor="pip-question" className="sr-only">Ask a question about this course</label>
              <input ref={inputRef} id="pip-question" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="Ask about this course…" autoComplete="off" />
              <Button type="submit" variant="brand" size="icon-sm" disabled={!input.trim()} aria-label="Send question"><ArrowUp /></Button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-ink-muted">Pip finds explanations in your course material. No live AI service is connected.</p>
          </>}
      </PopoverContent>
    </Popover>
  </div>;
}
