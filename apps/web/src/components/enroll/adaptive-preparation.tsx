"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Loader2, RotateCcw } from "lucide-react";
import { NarratedSlides } from "./narrated-slides";
import { ScenarioWorkspace } from "./scenario-workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError } from "@/lib/api";
import { loadAdaptiveSession } from "@/lib/adaptive-onboarding-client";
import type { AdaptiveSession, AdaptiveTask, ActivitySubmission } from "@/lib/adaptive-onboarding";
import type { PrecheckResult, SetupAnswers } from "@/lib/setup";
import type { Course } from "@/data/types";

type PreparationProps = {
  course: Course; answers: SetupAnswers; mode: "video" | "activity"; onPreviewDone?: () => void; onDone?: (result: PrecheckResult) => void;
};
export function AdaptivePreparation(props: PreparationProps) {
  // A profile edit replaces the entire player, including its pending requests and audio.
  return <PreparationSession key={JSON.stringify([props.course.course_id, props.answers])} {...props} />;
}
function PreparationSession({ course, answers, mode, onPreviewDone, onDone }: PreparationProps) {
  const [session, setSession] = React.useState<AdaptiveSession | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const profileKey = JSON.stringify(answers);
  React.useEffect(() => {
    let active = true;
    loadAdaptiveSession(course.course_id, JSON.parse(profileKey) as SetupAnswers).then(
      (value) => { if (active) { setSession(value); setLoading(false); } },
      (error: unknown) => { if (active) { setError(error instanceof Error ? error.message : "Your preparation could not be created."); setLoading(false); } },
    );
    return () => { active = false; };
  }, [course.course_id, profileKey]);
  async function reload() {
    setLoading(true); setError("");
    try { setSession(await loadAdaptiveSession(course.course_id, answers)); }
    catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    finally { setLoading(false); }
  }

  if (loading || !session) return <div className="mx-auto max-w-3xl py-12" aria-live="polite">
    <h1 className="text-3xl font-semibold">{mode === "video" ? "Preparing your starting point" : "Preparing your activity"}</h1>
    <p className="mt-4 text-ink-muted">Your learning context and goals shape the examples you’ll see. This can take about a minute.</p>
    {error ? <div role="alert" className="mt-6 space-y-4"><p>{error}</p><Button onClick={() => void reload()}><RotateCcw />Try again</Button></div>
      : <div className="mt-8 flex items-center gap-3"><Loader2 className="size-5 animate-spin" aria-hidden />Writing your preparation…</div>}
  </div>;

  if (mode === "video") return <NarratedSlides key={session.id} session={session} onDone={onPreviewDone!} />;
  if (session.done) return <ActivitySummary session={session} onDone={onDone!} />;

  return <div className="mx-auto max-w-5xl space-y-5">
    {session.task?.kind !== "simulation" && session.feedback ? <p role="status" className="text-sm text-ink-muted">{session.feedback}</p> : null}
    {session.task?.kind === "simulation" && session.task.workspace ? <ScenarioWorkspace key={`${session.id}:${session.task.id}`} session={session} task={session.task} onSession={setSession} onReload={reload} /> : session.task ? <ActivityEditor key={`${session.id}:${session.task.id}`} session={session} task={session.task} onSession={setSession} onReload={reload} /> : null}
  </div>;
}

export function ActivitySummary({ session, onDone }: { session: AdaptiveSession; onDone: (result: PrecheckResult) => void }) {
  return <div className="mx-auto max-w-2xl space-y-5">
    <Check className="size-9 text-ok" aria-hidden />
    <h1 className="text-3xl font-semibold">Your starting point is ready</h1>
    {session.feedback ? <p role="status" className="rounded-card border border-line bg-panel-2 p-4 text-sm">{session.feedback}</p> : null}
    <p className="text-ink-muted">{session.summary}</p>
    <details className="rounded-card border border-line p-4">
      <summary className="cursor-pointer text-sm font-medium">See what shaped your course</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><h2 className="text-sm font-semibold">Build on</h2><ul className="mt-2 space-y-2 text-sm text-ink-muted">{session.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div><h2 className="text-sm font-semibold">Explore next</h2><ul className="mt-2 space-y-2 text-sm text-ink-muted">{session.focus.map((s) => <li key={s}>{s}</li>)}</ul></div>
      </div>
    </details>
    <Button size="lg" onClick={() => onDone({ at: new Date().toISOString(), source: "activity", assessmentId: session.id, lessons: {}, activity: { summary: session.summary, strengths: session.strengths, focus: session.focus, evidence: session.evidence } })}>Continue<ArrowRight /></Button>
  </div>;
}

export function ActivityEditor({ session, task, onSession, onReload }: { session: AdaptiveSession; task: AdaptiveTask; onSession: (session: AdaptiveSession) => void; onReload: () => Promise<void> }) {
  const draftKey = `lms-adaptive-draft:${session.id}:${task.id}`;
  const [text, setText] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(() => task.kind === "arrange" ? task.items.map((item) => item.id) : []);
  const [confidence, setConfidence] = React.useState<ActivitySubmission["confidence"]>("not-stated");
  const [helpUsed, setHelpUsed] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);
  const [showMedia, setShowMedia] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [audioFailed, setAudioFailed] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const audio = React.useRef<HTMLAudioElement>(null);
  const lock = React.useRef(false);
  const submission = React.useRef<{ key: string; id: string } | null>(null);
  React.useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [task.id]);
  React.useEffect(() => { const element = audio.current; return () => { element?.pause(); }; }, [showMedia]);
  const mediaUrl = (kind: "audio" | "image") => `/api/v1/onboarding/media?id=${encodeURIComponent(session.id)}&kind=${kind}&task=${encodeURIComponent(task.id)}`;
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { text: string; selected: string[]; confidence: ActivitySubmission["confidence"]; helpUsed: boolean | null } | null;
        if (draft) {
          setText(typeof draft.text === "string" ? draft.text.slice(0, 2400) : "");
          const ids = new Set(task.items.map((item) => item.id));
          const valid = Array.isArray(draft.selected) && new Set(draft.selected).size === draft.selected.length && draft.selected.every((id) => ids.has(id));
          if (valid && (task.kind !== "arrange" || draft.selected.length === ids.size)) setSelected(draft.selected);
          if (["not-stated", "unsure", "partly", "confident"].includes(draft.confidence)) setConfidence(draft.confidence);
          setHelpUsed(typeof draft.helpUsed === "boolean" ? draft.helpUsed : null);
        }
      } catch { /* An unavailable browser store does not block the activity. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, task]);
  React.useEffect(() => { if (hydrated) { try { localStorage.setItem(draftKey, JSON.stringify({ text, selected, confidence, helpUsed })); } catch {} } }, [draftKey, hydrated, text, selected, confidence, helpUsed]);
  function move(id: string, direction: number) {
    const order = [...selected]; const index = order.indexOf(id); const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next]!, order[index]!]; setSelected(order);
  }
  async function submit(skipped: boolean) {
    if (lock.current || !hydrated) return;
    lock.current = true; setBusy(true); setError(""); audio.current?.pause();
    const response = { taskId: task.id, text, selected, confidence, helpUsed, skipped };
    const key = JSON.stringify(response);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    try {
      const result = await api<{ session: AdaptiveSession }>("/api/v1/onboarding/turn", { method: "POST", body: { id: session.id, response: { ...response, submissionId: submission.current.id } } });
      try { localStorage.removeItem(draftKey); } catch {}
      onSession(result.session);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) await onReload();
      else setError(error instanceof Error ? error.message : "Pip couldn’t review this. Please try again.");
    } finally { lock.current = false; setBusy(false); }
  }
  const draftInput = <label className="block space-y-2"><span className="text-sm font-medium">{task.kind === "compose" ? "Your draft" : "Your note"}</span><Textarea value={text} maxLength={2400} rows={3} onChange={(event) => setText(event.target.value)} placeholder="A few words are fine. Use made-up details." /></label>;
  return <form onSubmit={(event) => { event.preventDefault(); void submit(false); }} className="space-y-5" aria-busy={busy}>
    <header><h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none md:text-3xl">{task.title}</h1><p className="mt-2 text-ink-muted">{task.scene}</p></header>
    <fieldset disabled={busy || !hydrated} className="space-y-5">
      <legend className="sr-only">{task.title}</legend>
      <h2 className="font-medium">{task.instruction}</h2>
      <details className="text-sm"><summary className="cursor-pointer text-ink-muted">Task details</summary><p className="mt-3 whitespace-pre-line rounded-card border border-line bg-panel-2 px-4 py-3 leading-relaxed">{task.artifact}</p></details>
      {task.kind === "arrange" ? <ol aria-label="Your step order" className="space-y-2">{selected.map((id, i) => <li key={id} className="flex items-center gap-3 rounded-card border border-line bg-panel px-3 py-2.5">
        <span className="font-mono text-xs text-ink-faint">{i + 1}</span><span className="flex-1 text-sm">{task.items.find((item) => item.id === id)?.text}</span>
        <Button type="button" variant="ghost" size="icon" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => move(id, -1)}><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={i === selected.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => move(id, 1)}><ArrowDown /></Button>
      </li>)}</ol> : null}
      {task.kind === "select" ? <div className="space-y-2">{task.items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-card border border-line p-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-current" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />{item.text}</label>)}</div> : null}
      {task.kind === "compose" ? draftInput : null}
      <details className="text-sm"><summary className="cursor-pointer text-ink-muted">Add a note or reflection</summary><div className="mt-3 space-y-4">
        {task.kind !== "compose" ? draftInput : null}
        <fieldset><legend className="mb-2 font-medium">How did it feel?</legend><div className="flex flex-wrap gap-3">{([['unsure', 'New to me'], ['partly', 'Getting there'], ['confident', 'Comfortable']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name={`confidence-${task.id}`} value={value} checked={confidence === value} onChange={() => setConfidence(value)} />{label}</label>)}</div></fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" checked={helpUsed === true} onChange={(event) => setHelpUsed(event.target.checked)} />I used help</label>
      </div></details>
    </fieldset>
    <Button type="button" variant="ghost" size="sm" onClick={() => setShowMedia((shown) => !shown)} aria-expanded={showMedia} aria-controls="activity-media">{showMedia ? "Hide scene and audio" : "Scene and audio"}</Button>
    {showMedia ? <div id="activity-media" className="space-y-3 rounded-card border border-line p-4">
      <audio ref={audio} controls preload="none" src={mediaUrl("audio")} className="w-full" aria-label={`Read the task: ${task.title}`} onError={() => setAudioFailed(true)} />
      {audioFailed ? <p role="status" className="text-sm text-ink-muted">Audio couldn’t load. You can read the task above.</p> : null}
      {!imageFailed ? <motion.img src={mediaUrl("image")} alt={`Scene: ${task.title}`} onError={() => setImageFailed(true)} className="aspect-video w-full max-w-sm rounded-card object-cover" /> : null}
    </div> : null}
    {error ? <p role="alert" className="text-sm text-ink">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button size="lg" type="submit" disabled={busy || !hydrated || (task.kind === "arrange" ? selected.length !== task.items.length : !text.trim() && !selected.length)}>{busy ? <><Loader2 className="animate-spin" />One moment…</> : <>Continue<ArrowRight /></>}</Button><Button type="button" variant="ghost" disabled={busy || !hydrated} onClick={() => void submit(true)}>This is new to me</Button></div>
  </form>;
}
