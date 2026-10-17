"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Bot, Inbox, Loader2, Play, Plus, Send, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError } from "@/lib/api";
import { editWorkspace, restoreWorkspace, type WorkspaceDraft, type WorkspaceEdit } from "@/lib/scenario-workspace-state";
import type { AdaptiveSession, AdaptiveTask, ActivitySubmission } from "@/lib/adaptive-onboarding";

export function ScenarioWorkspace({ session, task, onSession, onReload }: { session: AdaptiveSession; task: AdaptiveTask; onSession: (session: AdaptiveSession) => void; onReload: () => Promise<void> }) {
  const world = task.workspace!;
  const [draft, setDraft] = React.useState<WorkspaceDraft>(() => restoreWorkspace(session.configuration, task.items.map((item) => item.id)));
  const [hydrated, setHydrated] = React.useState(false);
  const [runFrame, setRunFrame] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showAudio, setShowAudio] = React.useState(false);
  const [audioFailed, setAudioFailed] = React.useState(false);
  const lock = React.useRef(false);
  const submission = React.useRef<{ key: string; id: string } | null>(null);
  const audio = React.useRef<HTMLAudioElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const draftKey = `lms-scenario-draft:${session.id}:${task.id}`;
  const initialConfiguration = JSON.stringify(session.configuration ?? null);
  const itemIds = JSON.stringify(task.items.map((item) => item.id));
  React.useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => {
      try { setDraft(restoreWorkspace(JSON.parse(localStorage.getItem(draftKey) ?? initialConfiguration), JSON.parse(itemIds) as string[])); } catch {}
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, itemIds, initialConfiguration]);
  React.useEffect(() => { if (hydrated) { try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch {} } }, [draftKey, draft, hydrated]);
  React.useEffect(() => { const element = audio.current; return () => { element?.pause(); }; }, [showAudio]);
  React.useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setRunFrame((frame) => Math.min(frame + 1, draft.selected.length + 1)), 850);
    return () => window.clearInterval(timer);
  }, [busy, draft.selected.length]);
  function edit(action: WorkspaceEdit) { if (!lock.current) setDraft((before) => editWorkspace(before, action)); }
  async function run(skipped = false) {
    if (lock.current || !hydrated || (!skipped && !draft.selected.length)) return;
    lock.current = true; setRunFrame(0); setBusy(true); setError(""); audio.current?.pause();
    const response: Omit<ActivitySubmission, "submissionId"> = { taskId: task.id, text: draft.text, selected: draft.selected, events: [...draft.events, { type: "run" }], confidence: "not-stated", helpUsed: null, skipped };
    const key = JSON.stringify(response);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    try {
      const result = await api<{ session: AdaptiveSession }>("/api/v1/onboarding/turn", { method: "POST", body: { id: session.id, response: { ...response, submissionId: submission.current.id } } });
      try { localStorage.removeItem(draftKey); } catch {}
      onSession(result.session);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) await onReload();
      else setError(cause instanceof Error ? cause.message : "Your run couldn’t finish. Try again with this configuration.");
    } finally { lock.current = false; setBusy(false); }
  }
  const active = draft.selected.map((id) => task.items.find((item) => item.id === id)!);
  return <section className="space-y-5" aria-label="Interactive scenario workspace" aria-busy={busy}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-widest text-brand-ink">Your mission</p><h1 ref={heading} tabIndex={-1} className="mt-2 text-2xl font-semibold outline-none md:text-3xl">{task.title}</h1><p className="mt-2 max-w-2xl text-sm text-ink-muted">{task.scene}</p></div><Button size="sm" variant="ghost" onClick={() => setShowAudio((show) => !show)} aria-expanded={showAudio}><Volume2 className="size-4" />Hear the scene</Button></header>
    {showAudio ? <div className="space-y-2"><audio ref={audio} controls preload="none" className="w-full" aria-label="Scene narration" src={`/api/v1/onboarding/media?id=${encodeURIComponent(session.id)}&kind=audio&task=${encodeURIComponent(task.id)}`} onError={() => setAudioFailed(true)} />{audioFailed ? <p role="status" className="text-sm text-ink-muted">Narration couldn’t load. The scene is written below.</p> : null}</div> : null}
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel-2 px-5 py-3"><p className="text-sm font-medium">{world.name}</p><span className="text-xs text-ink-muted">Simulation · fictional data</span></div>
      <div className="relative p-4 md:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-accent-soft px-4 py-3" role="status"><Bot className="size-5 shrink-0 text-brand-ink" /><p className="text-sm">{world.state}</p></div>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
          <article className={`space-y-3 rounded-xl border border-line bg-panel-2 p-4 ${busy && runFrame === 0 ? "ring-2 ring-brand-ink" : ""}`}><h2 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-brand-ink" />{world.incomingLabel}</h2><p className="text-sm leading-relaxed">{world.request}</p><p className="whitespace-pre-line border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">{task.artifact}</p></article>
          <fieldset disabled={busy || !hydrated} className="min-w-0 space-y-3 rounded-xl border border-line bg-panel p-4">
            <legend className="sr-only">Build your agent workflow</legend><h2 className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-brand-ink" />{world.agentLabel}</h2><p className="text-xs text-ink-muted">{task.instruction}</p>
            <ol aria-label="Your workflow" className="min-h-24 space-y-2 rounded-lg border border-dashed border-line p-2" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (task.items.some((item) => item.id === id)) edit({ type: "add", itemId: id }); }}>
              {!active.length ? <li className="flex min-h-20 items-center justify-center px-3 text-center text-xs text-ink-muted">Add actions from the tray below.</li> : active.map((item, i) => <motion.li layout={!reduced} initial={false} key={item.id} className={`scenario-action flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2 py-2 ${busy && runFrame === i + 1 ? "ring-2 ring-brand-ink" : ""}`}>
                <span className="text-xs text-brand-ink">{i + 1}</span><span className="flex-1 text-xs font-medium">{item.text}</span><div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} aria-label={`Move ${item.text} up`} onClick={() => edit({ type: "move", itemId: item.id, position: i - 1 })}><ArrowUp className="size-3" /></Button><Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === active.length - 1} aria-label={`Move ${item.text} down`} onClick={() => edit({ type: "move", itemId: item.id, position: i + 1 })}><ArrowDown className="size-3" /></Button><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove ${item.text}`} onClick={() => edit({ type: "remove", itemId: item.id })}><X className="size-3" /></Button></div>
              </motion.li>)}
            </ol>
            <label className="block space-y-2"><span className="text-xs text-ink-muted">Agent instructions <span className="text-ink-faint">· optional</span></span><Textarea value={draft.text} onChange={(event) => setDraft((before) => ({ ...before, text: event.target.value }))} onBlur={() => edit({ type: "edit", text: draft.text })} rows={2} maxLength={2400} placeholder={world.instructionPlaceholder} className="text-sm" /></label>
          </fieldset>
          <article className={`space-y-3 rounded-xl border border-line bg-panel-2 p-4 ${busy && runFrame > active.length ? "ring-2 ring-brand-ink" : ""}`}><h2 className="flex items-center gap-2 text-sm font-semibold"><Send className="size-4 text-brand-ink" />{world.outputLabel}</h2><p className="text-sm leading-relaxed" aria-live="polite">{busy ? "Pip is simulating your workflow. Your outcome will appear here…" : session.feedback || "Your run will appear here."}</p>{session.feedback && !busy ? <p className="text-xs text-ink-muted">Previous run</p> : null}</article>
        </div>
        <div className="scenario-run-track relative mt-5 h-6 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">{busy ? <motion.div className="scenario-packet absolute inset-y-0 left-0 flex w-8 items-center justify-center rounded-full bg-brand text-white" animate={{ left: reduced ? "45%" : `${Math.min(90, runFrame / (active.length + 1) * 90)}%` }} transition={{ duration: reduced ? 0 : 0.75, ease: "easeInOut" }}><Send className="size-3" /></motion.div> : <div className="flex h-full items-center justify-center"><ArrowRight className="size-3 text-ink-faint" /></div>}</div>
        <div className="mt-2 flex justify-between gap-3 text-[10px] text-ink-muted" aria-hidden="true"><span>{world.incomingLabel}</span><span>{busy && runFrame > 0 && runFrame <= active.length ? active[runFrame - 1]?.text : world.agentLabel}</span><span>{world.outputLabel}</span></div>
      </div>
      <fieldset disabled={busy || !hydrated} className="space-y-3 border-t border-line bg-panel-2 p-4 md:px-6"><legend className="sr-only">Action tray</legend><p className="text-xs font-medium text-ink-muted">Action tray <span className="font-normal">· add, reorder, then run</span></p><div className="flex flex-wrap gap-2">{task.items.map((item) => <button key={item.id} type="button" draggable={!busy && !draft.selected.includes(item.id)} onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} disabled={draft.selected.includes(item.id)} onClick={() => edit({ type: "add", itemId: item.id })} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-xs font-medium transition hover:border-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ink disabled:cursor-default disabled:opacity-40"><Plus className="size-3 shrink-0" aria-hidden />{item.text}</button>)}</div></fieldset>
    </div>
    {error ? <p role="alert" className="text-sm">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button size="lg" disabled={busy || !hydrated || !draft.selected.length} onClick={() => void run()}>{busy ? <><Loader2 className="size-4 animate-spin" />Simulating…</> : <><Play className="size-4" />{world.runLabel}</>}</Button><Button variant="ghost" size="sm" disabled={busy || !hydrated} onClick={() => void run(true)}>Explore this with help<ArrowRight className="size-4" /></Button></div>
  </section>;
}
