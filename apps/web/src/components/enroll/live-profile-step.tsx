"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Pause, PenLine, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/kit/progress-ring";
import { PipMascot } from "@/components/learning/pip-mascot";
import { api } from "@/lib/api";
import { COMFORT_QUESTION, type SetupAnswers } from "@/lib/setup";
import { PREFIX, QUESTION_COUNT, profileFromAnswers, typedTag, type ProfileAnswer, type ProfileOption, type ProfileQuestion } from "@/lib/profiling";
import { ProfileConversation, type ProfileTurn } from "@/lib/profile-conversation";
import { ProfileVoice, type ProfileVoiceState } from "@/lib/profile-voice";

const OWNED = ["learningContext", "learningContextDetail", "domain", "domainOther", "role", "roleOther", "goal", "experience", "subRole", "useCase", "goalDetail", "tags"] as const;
function completedProfile(saved: SetupAnswers, list: (ProfileAnswer | null)[]): SetupAnswers {
  const kept = { ...saved };
  for (const key of OWNED) delete kept[key];
  return { ...kept, ...profileFromAnswers(list.filter((a): a is ProfileAnswer => !!a)).setup };
}
function savedChoice(q: ProfileQuestion, saved: SetupAnswers): ProfileAnswer | null {
  const tags = saved.tags ?? [];
  const option = q.options.find((x) => !x.freeText && tags.includes(x.tag));
  if (option) return { slot: q.slot, question: q.text, label: option.label, tag: option.tag };
  const words = { context: saved.learningContextDetail, field: saved.domainOther, subrole: saved.subRole, usecase: saved.useCase, goal: saved.goalDetail, experience: undefined }[q.slot];
  const tag = tags.find((x) => x.startsWith(`${PREFIX[q.slot]}:`));
  return words && tag && q.options.some((x) => x.freeText) ? { slot: q.slot, question: q.text, label: words, tag } : null;
}

export function LiveProfileStep({ courseId, name, answers: saved, setAnswers, needs, setNeeds, continueLabel, onDone }: {
  courseId: string; name: string; answers: SetupAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<SetupAnswers>>;
  needs: string[]; setNeeds: React.Dispatch<React.SetStateAction<string[]>>;
  continueLabel: string; onDone: (answers: SetupAnswers) => Promise<void>;
}) {
  const t = useTranslations("enroll");
  const [sound, setSound] = React.useState(true);
  const [voiceState, setVoiceState] = React.useState<ProfileVoiceState>("idle");
  const [browserVoice, setBrowserVoice] = React.useState(false);
  const [voice] = React.useState(() => new ProfileVoice((status, browser) => { setVoiceState(status); setBrowserVoice(browser); }));
  const conversation = React.useMemo(() => new ProfileConversation(
    async (request) => {
      const turn = await api<ProfileTurn>("/api/v1/profiling/conversation", { method: "POST", body: { courseId, ...request } });
      // Prepare the question's voice while Pip acknowledges the answer.
      if (voice.enabled && turn.reply && turn.questionAudio) void fetch(turn.questionAudio).catch(() => {});
      return turn;
    }, voice,
    (list) => setAnswers((previous) => completedProfile(previous, list)),
  ), [courseId, voice, setAnswers]);
  const state = React.useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
  React.useEffect(() => () => conversation.dispose(), [conversation]);
  const [typing, setTyping] = React.useState(false);
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const savingLock = React.useRef(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { if (state.phase === "listening") heading.current?.focus({ preventScroll: true }); }, [state.at, state.phase]);
  const q = state.question;
  const listening = state.phase === "listening";
  const last = state.at === QUESTION_COUNT - 1;
  const chosen = state.given[state.at] === undefined ? savedChoice(q, saved) : state.given[state.at];
  const typedChosen = !!chosen && !q.options.some((o) => !o.freeText && o.tag === chosen.tag);
  const freeOption = q.options.find((o) => o.freeText);
  const pick = (o: ProfileOption, typed?: string) => {
    if (!listening) return;
    setTyping(false); setText("");
    void conversation.answer({ slot: q.slot, question: q.text, label: typed ?? o.label, tag: typed ? typedTag(q.slot, typed) : o.tag });
  };
  const speaking = voiceState === "playing";
  const status = state.phase === "idle" ? ""
    : state.phase === "error" ? "Let’s try that again. Your choice is kept."
    : state.phase === "preparing" ? (state.given.length ? "Thinking about your answer…" : "Getting your first question ready…")
    : voiceState === "loading" ? "Preparing my voice…"
    : voiceState === "blocked" ? "Tap Hear Pip to allow audio."
    : voiceState === "paused" ? "Paused. Resume when you’re ready."
    : speaking ? (state.phase === "reply" ? "Responding to your answer…" : "Reading your question…")
    : state.phase === "complete" ? "Ready when you are."
    : "Your turn.";
  function toggleSound() {
    const next = !sound; setSound(next); voice.setMuted(!next);
    if (next) voice.unlock();
    if (state.phase === "error") void conversation.retry();
  }
  async function finish() {
    if (state.phase !== "complete" || savingLock.current) return;
    savingLock.current = true; setSaving(true); setSaveError("");
    try { await onDone(completedProfile(saved, state.given)); }
    catch { setSaveError(t("profileSaveFailed")); }
    finally { savingLock.current = false; setSaving(false); }
  }

  return <div className="mx-auto flex max-w-2xl flex-col gap-6">
    <div className="flex items-center gap-3">
      <ProgressBar value={state.phase === "complete" ? 1 : state.at / QUESTION_COUNT} size="sm" aria-label={t("lpOf", { n: state.at + 1, total: QUESTION_COUNT })} />
      <span className="shrink-0 font-mono text-xs text-ink-faint">{state.at + 1}/{QUESTION_COUNT}</span>
    </div>
    <section className="rounded-card border border-brand-line bg-brand-soft p-4" aria-label="Pip, your learning companion">
      <div className="flex items-center gap-4">
        <PipMascot className="h-24 w-22 shrink-0" reaction={speaking ? "wave" : state.phase === "preparing" ? "think" : state.phase === "complete" ? "celebrate" : "idle"} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pip · Your learning companion</p>
          {status ? <p className="mt-1 text-sm text-ink-muted" role="status">{status}</p> : null}
          {state.reply ? <p className="mt-3 text-base text-brand-ink" aria-live="polite">{state.reply}</p> : null}
          {browserVoice ? <p className="mt-2 text-xs text-ink-muted">Using your device’s voice while cloud narration is unavailable.</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {state.phase === "idle" ? <>
          <Button variant="brand" onClick={() => { voice.unlock(); void conversation.start(); }}><Volume2 />Start with Pip</Button>
          <Button variant="ghost" onClick={() => { setSound(false); voice.setMuted(true); void conversation.start(); }}>Read instead</Button>
        </> : <>
          <Button size="sm" variant="ghost" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 /> : <VolumeX />}{sound ? "Read instead" : "Turn voice on"}</Button>
          {voiceState === "playing" ? <Button size="sm" variant="outline" onClick={() => voice.pause()}><Pause />Pause voice</Button> : null}
          {voiceState === "paused" || voiceState === "blocked" ? <Button size="sm" variant="brand" onClick={() => voice.resume()}><Play />{voiceState === "blocked" ? "Hear Pip" : "Resume voice"}</Button> : null}
          {listening && sound ? <Button size="sm" variant="ghost" onClick={() => void conversation.replay()}><RotateCcw />Hear question again</Button> : null}
          {state.phase === "error" ? <Button size="sm" variant="outline" onClick={() => void conversation.retry()}><RotateCcw />Try again</Button> : null}
        </>}
      </div>
      {state.error ? <p className="mt-3 text-sm text-err" role="alert">{state.error}</p> : null}
    </section>
    <section className="flex flex-col gap-5" aria-labelledby="lp-q" aria-busy={state.phase === "preparing"}>
      <div>
        {state.at === 0 ? <p className="text-sm text-ink-muted">{t("lpHello", { name: name.split(/\s+/)[0] })}</p> : null}
        <h1 ref={heading} tabIndex={-1} id="lp-q" className="mt-1 text-2xl font-semibold tracking-tight text-balance outline-none md:text-3xl">{q.text}</h1>
        {q.why ? <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-faint"><Info className="size-3.5 shrink-0" aria-hidden />{q.why}</p> : null}
      </div>
      <div role="group" aria-labelledby="lp-q" className="grid gap-2.5 sm:grid-cols-2">
        {q.options.filter((o) => !o.freeText).map((o) => {
          const on = chosen?.tag === o.tag;
          return <button key={o.tag} type="button" aria-pressed={on} disabled={!listening} onClick={() => pick(o)}
            className={cn("flex min-h-14 items-center justify-between gap-3 rounded-card border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default disabled:opacity-60", on ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line bg-panel hover:border-brand-line")}>
            {o.label}{on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
          </button>;
        })}
        {freeOption ? typing && listening ? <form className="flex gap-2 sm:col-span-2" onSubmit={(event) => { event.preventDefault(); const value = text.trim().slice(0, 60); if (value) pick(freeOption, value); }}>
          <Input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={t("lpOtherPlaceholder")} aria-label={freeOption.label} maxLength={60} className="h-12" />
          <Button type="submit" variant="brand" disabled={!text.trim()}>{t("lpUse")}</Button>
        </form> : <button type="button" aria-pressed={typedChosen} disabled={!listening} onClick={() => { setText(typedChosen && chosen ? chosen.label : ""); setTyping(true); }}
          className={cn("flex min-h-14 items-center gap-2 rounded-card border border-dashed px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default disabled:opacity-60", typedChosen ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line text-ink-muted")}>
          <PenLine className="size-4" aria-hidden />{typedChosen && chosen ? chosen.label : freeOption.label}
        </button> : null}
      </div>
      {last ? <div className="flex flex-col gap-2.5 border-t border-line pt-5">
        <div className="text-sm font-medium">{COMFORT_QUESTION.q}</div>
        <div className="flex flex-wrap gap-2">{COMFORT_QUESTION.options.map((o) => {
          const on = needs.includes(o.v);
          return <button key={o.v} type="button" aria-pressed={on} disabled={saving} onClick={() => setNeeds((previous) => o.v === "none" ? (on ? [] : ["none"]) : on ? previous.filter((x) => x !== o.v) : [...previous.filter((x) => x !== "none"), o.v])}
            className={cn("flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm", on ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line bg-panel")}>
            {on ? <Check className="size-3.5" aria-hidden /> : null}{o.label}
          </button>;
        })}</div>
      </div> : null}
      {saveError ? <p role="alert" className="text-sm text-err">{saveError}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" disabled={state.at === 0 || saving} onClick={() => { setTyping(false); setText(""); void conversation.back(); }}><ArrowLeft />{t("back")}</Button>
        {state.phase === "complete" ? <Button size="lg" variant="brand" disabled={saving} onClick={() => void finish()}>{saving ? <Loader2 className="animate-spin" /> : null}{saving ? "Saving your profile…" : continueLabel}<ArrowRight /></Button>
          : <Button variant="ghost" disabled={!listening} onClick={() => { setTyping(false); void conversation.answer(chosen ?? null); }}>{chosen ? "Use this answer" : t("skip")}{chosen ? <ArrowRight /> : null}</Button>}
      </div>
    </section>
  </div>;
}
