"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock3, EyeOff, Film, Loader2, Mic, MicOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCompanionStep } from "@/components/learning/course-companion";
import { MissionScreen } from "@/components/enroll/mission-screen";
import { MissionStage } from "@/components/enroll/mission-stage";
import { api } from "@/lib/api";
import { loadMission } from "@/lib/mission-client";
import { msSince, recognitionCtor, useCanListen, type Recognition } from "@/lib/speech";
import { narrate, pauseNarration, resumeNarration, stopNarration, useNarration } from "@/lib/narrator";
import type { MissionAnswer, MissionMoment, MissionScript, MissionWhy } from "@/lib/mission";
import { questionById, answerLabel, type PrecheckResult, type SetupAnswers } from "@/lib/setup";

type Result = { lessons: Record<string, 0 | 1 | 2>; activity: NonNullable<PrecheckResult["activity"]> & { summary: string; strengths: string[]; focus: string[] } };

type Beat =
  | { t: "open" }
  | { t: "card"; scene: number }
  | { t: "scene"; scene: number }
  | { t: "moment"; scene: number; moment: MissionMoment }
  | { t: "why"; scene: number };

const fieldOf = (a: SetupAnswers) => {
  const q = questionById("domain", a);
  return (q ? answerLabel(q, a) : null)?.toLowerCase() ?? "your field";
};

/** What is being made while the story is written, ticked off as time passes; all ticked once it's ready. */
const PREP = ["msPrepPlace", "msPrepCast", "msPrepScreen", "msPrepCalls"] as const;
const PREP_AT = [0, 3500, 8000, 13000];

function Preparing({ ready, field }: { ready: boolean; field: string }) {
  const t = useTranslations("enroll");
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (ready) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 500);
    return () => window.clearInterval(id);
  }, [ready]);
  return (
    <ol className="flex flex-col gap-2 rounded-card border border-line bg-panel p-4 text-sm" aria-live="polite">
      {PREP.map((key, i) => {
        const started = ready || elapsed >= PREP_AT[i]!;
        const done = ready || elapsed >= (PREP_AT[i + 1] ?? Infinity);
        return (
          <li key={key} className={cn("flex items-center gap-2.5 transition-colors", started ? "text-ink" : "text-ink-faint")}>
            {done ? <Check className="size-4 text-ok" aria-hidden /> : started ? <Loader2 className="size-4 animate-spin text-brand-ink" aria-hidden /> : <span className="size-4 rounded-full border border-line" aria-hidden />}
            {t(key, { field })}
          </li>
        );
      })}
    </ol>
  );
}

/** What a beat says aloud, and its key for the voice route (missionLines): title cards say nothing. */
function spokenLine(m: MissionScript, b: Beat): { key: string; text: string } | null {
  if (b.t === "open") return { key: "open", text: `${m.setting} ${m.title}.` };
  if (b.t === "scene") return { key: `scene-${b.scene}`, text: m.scenes[b.scene]!.narration };
  if (b.t === "moment") return { key: b.moment.id, text: b.moment.prompt };
  if (b.t === "why") return { key: "why", text: m.whyPrompt };
  return null;
}

/** Gemini's recording of a line, when the story has a voice; null reads it with the browser's voice. */
const voiceUrl = (m: MissionScript, key: string) => (m.voice ? `/api/v1/mission/voice?id=${encodeURIComponent(m.id)}&line=${encodeURIComponent(key)}` : null);

/** The story as a list of beats: opening, then per scene a title card, the scene, its moments (and the "why"). */
function beatsOf(m: MissionScript): Beat[] {
  const out: Beat[] = [{ t: "open" }];
  m.scenes.forEach((s, scene) => {
    out.push({ t: "card", scene }, { t: "scene", scene });
    for (const moment of s.moments) {
      out.push({ t: "moment", scene, moment });
      if (moment.id === m.whyMoment) out.push({ t: "why", scene });
    }
  });
  return out;
}

/**
 * The Mission: replaces the quick check with a two-minute story from the
 * learner's own work (lib/mission.ts). Scenes play like a short film; at each
 * moment the learner makes a call (a reply, an instruction, an approval),
 * which quietly shows the idea they hold for one course module. Nothing is
 * marked right or wrong. The answer key stays on the server, which scores
 * the choices and the one "why" at the end. The tone follows the learner:
 * warmer for students, a brief for senior professionals, never a game.
 */
export function MissionStep({
  courseId,
  courseTitle,
  answers,
  onDone,
  onChat,
  onQuiz,
}: {
  courseId: string;
  courseTitle: string;
  answers: SetupAnswers;
  onDone: (result: PrecheckResult) => void;
  onChat: () => void;
  onQuiz: () => void;
}) {
  const t = useTranslations("enroll");
  const reduce = useReducedMotion();
  useCompanionStep({ title: courseTitle, phase: "precheck", guidance: "Make the calls as the story unfolds. Nothing is marked right or wrong." });

  const [mission, setMission] = React.useState<MissionScript | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const [beat, setBeat] = React.useState(0);
  const [voice, setVoice] = React.useState(true);
  const [imagesOff, setImagesOff] = React.useState(false);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [switches, setSwitches] = React.useState(0);
  const [given, setGiven] = React.useState<MissionAnswer[]>([]);
  const [why, setWhy] = React.useState<MissionWhy | null>(null);
  const [draft, setDraft] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [usedVoice, setUsedVoice] = React.useState(false);
  const [finishing, setFinishing] = React.useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = React.useState<Result | null>(null);
  const shownAt = React.useRef(0);
  const narration = useNarration();
  const canListen = useCanListen();
  const recognition = React.useRef<Recognition | null>(null);
  // answers kept here too, so finishing never reads a stale list
  const answersRef = React.useRef(answers);

  const load = React.useCallback(async () => {
    try {
      // usually already written: the request starts when "About you" ends (lib/mission-client.ts)
      const m = await loadMission(courseId, answersRef.current);
      setMission(m);
      // start drawing scene 1 early; if pictures are unavailable, stay with the designed sets
      if (m.images)
        void fetch(`/api/v1/mission/image?id=${m.id}&scene=0`).then(
          (r) => {
            if (!r.ok) setImagesOff(true);
          },
          () => setImagesOff(true),
        );
    } catch {
      setLoadError(true);
    }
  }, [courseId]);

  React.useEffect(() => {
    void load(); // the story is written while the learner reads the intro
  }, [load]);
  React.useEffect(() => stopNarration, []);

  const beats = React.useMemo(() => (mission ? beatsOf(mission) : []), [mission]);
  const b = beats[beat];
  const sceneNo = b && b.t !== "open" ? b.scene : 0;
  const momentIndex = mission ? mission.scenes.flatMap((s) => s.moments).findIndex((m) => b?.t === "moment" && m.id === b.moment.id) : -1;

  // each beat: read it aloud, start the decision clock, and move title cards on by themselves
  React.useEffect(() => {
    if (!started || !mission || !b) return;
    shownAt.current = Date.now();
    const line = spokenLine(mission, b);
    if (voice && line?.text) narrate(voiceUrl(mission, line.key), line.text);
    // record the next spoken line now, so it's ready when the learner gets there
    const upcoming = voice && mission.voice ? beats.slice(beat + 1).map((x) => spokenLine(mission, x)).find(Boolean) : null;
    if (upcoming) void fetch(`${voiceUrl(mission, upcoming.key)}&ahead=1`).catch(() => undefined);
    if (b.t === "card") {
      const id = setTimeout(() => setBeat((n) => n + 1), reduce ? 1200 : 2400);
      return () => clearTimeout(id);
    }
  }, [started, mission, b, beat, beats, voice, reduce]);

  async function finish(list: MissionAnswer[], w: MissionWhy | null) {
    if (!mission) return;
    stopNarration();
    setFinishing("busy");
    try {
      const { result: r } = await api<{ result: Result }>("/api/v1/mission/finish", { method: "POST", body: { id: mission.id, answers: list, why: w } });
      setResult(r);
      setFinishing("idle");
    } catch {
      setFinishing("error");
    }
  }

  function next(list = given, w = why) {
    if (beat + 1 >= beats.length) void finish(list, w);
    else setBeat(beat + 1);
  }

  function choose(id: string) {
    if (picked && picked !== id) setSwitches((n) => n + 1);
    setPicked(id);
  }

  function confirm(option: string | null) {
    if (b?.t !== "moment") return;
    const list = [...given.filter((a) => a.moment !== b.moment.id), { moment: b.moment.id, option, ms: msSince(shownAt.current), switches }];
    setGiven(list);
    setPicked(null);
    setSwitches(0);
    next(list);
  }

  function submitWhy(skip: boolean) {
    if (!mission) return;
    recognition.current?.stop();
    const w = skip || !draft.trim() ? null : { moment: mission.whyMoment, text: draft.trim().slice(0, 600), voice: usedVoice };
    setWhy(w);
    setDraft("");
    next(given, w);
  }

  function toggleMic() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) return recognition.current?.stop();
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setDraft(Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    setListening(true);
    setUsedVoice(true);
    r.start();
  }

  /* ---------------- the result ---------------- */
  if (result) {
    const a = result.activity;
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("discDoneKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("discDoneTitle")}</h1>
          <p className="mt-3 text-ink-muted">{a.summary}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: t("discKnow"), items: a.strengths, tone: "text-ok" },
            { title: t("discHelp"), items: a.focus, tone: "text-brand-ink" },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.title} className="rounded-card border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold">{g.title}</h2>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {g.items.map((s) => (
                    <li key={s} className="flex gap-2">
                      <Check className={cn("mt-0.5 size-4 shrink-0", g.tone)} aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
        {a.learning ? (
          <section className="rounded-card border border-brand-line bg-brand-soft/60 p-4">
            <h2 className="text-sm font-semibold text-brand-ink">{t("discLearnStyle")}</h2>
            <p className="mt-1 text-sm">{a.learning.note}</p>
          </section>
        ) : null}
        <p className="text-sm text-ink-faint">{t("discAdapts")}</p>
        <Button size="lg" variant="brand" className="w-fit" onClick={() => onDone({ at: new Date().toISOString(), source: "activity", lessons: result.lessons, activity: a })}>
          {t("discContinue")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </motion.div>
    );
  }

  /* ---------------- the intro (the story is being written meanwhile) ---------------- */
  if (!started || !mission || !b) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("msKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{t("msTitle")}</h1>
          <p className="mt-3 text-ink-muted">{t("msBody")}</p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm text-ink-muted">
          {[
            { icon: <Clock3 />, text: t("msTime") },
            { icon: <Film />, text: t("msWorld") },
            { icon: <EyeOff />, text: t("msNoScore") },
          ].map((x) => (
            <li key={x.text} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 [&_svg]:size-4 [&_svg]:text-brand-ink">
              {x.icon}
              {x.text}
            </li>
          ))}
        </ul>
        {!loadError ? <Preparing ready={!!mission} field={fieldOf(answers)} /> : null}
        {loadError ? (
          <div className="flex items-center gap-3 text-sm text-err">
            {t("msError")}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoadError(false);
                void load();
              }}
            >
              {t("msRetry")}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="brand" disabled={!mission} onClick={() => setStarted(true)}>
            {mission ? t("msBegin") : t("msPreparing")}
            {mission ? <ArrowRight data-icon="inline-end" /> : <Loader2 className="animate-spin" data-icon="inline-end" />}
          </Button>
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}

            aria-pressed={voice}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            {voice ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            {voice ? t("msVoiceOn") : t("msVoiceOff")}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-faint">
          <button type="button" onClick={onChat} className="underline-offset-4 hover:text-ink hover:underline">
            {t("msChat")}
          </button>
          <button type="button" onClick={onQuiz} className="underline-offset-4 hover:text-ink hover:underline">
            {t("discQuiz")}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- the film ---------------- */
  const exec = mission.audience === "executive";
  const scene = mission.scenes[sceneNo]!;
  const imageUrl = mission.images && !imagesOff ? `/api/v1/mission/image?id=${mission.id}&scene=${sceneNo}` : null;
  const speaker =
    b.t === "moment"
      ? b.moment.kind === "reply"
        ? `${mission.cast.name} · ${mission.cast.role}`
        : exec
          ? t("msDecision")
          : t("msAssistant")
      : b.t === "why"
        ? mission.cast.name
        : null;
  const line = b.t === "open" ? "" : (spokenLine(mission, b)?.text ?? "");
  const total = mission.scenes.length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <MissionStage field={mission.field} scene={sceneNo} audience={mission.audience} imageUrl={imageUrl} dim={b.t === "moment" || b.t === "why"} onImageError={() => setImagesOff(true)}>
        <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-medium tracking-[0.18em] text-white/60 uppercase sm:px-6">
          <span>{b.t === "open" ? mission.title : t(exec ? "msBrief" : "msScene", { n: sceneNo + 1, total })}</span>
          {/* narration controls: hear the line again, pause or carry on, or switch narration off */}
          <div className="flex items-center gap-0.5">
            {spokenLine(mission, b) ? (
              <>
                {/* always in place, so it never moves under the pointer: pause while playing, play otherwise */}
                <button
                  type="button"
                  onClick={() => {
                    const l = spokenLine(mission, b);
                    if (narration === "playing") pauseNarration();
                    else if (narration === "paused") resumeNarration();
                    else if (l) narrate(voiceUrl(mission, l.key), l.text);
                  }}
                  aria-label={narration === "playing" ? t("msPause") : t("msResume")}
                  title={narration === "playing" ? t("msPause") : t("msResume")}
                  className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {narration === "loading" ? <Loader2 className="size-4 animate-spin" /> : narration === "playing" ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = spokenLine(mission, b);
                    if (l) narrate(voiceUrl(mission, l.key), l.text);
                  }}
                  aria-label={t("msReplay")}
                  title={t("msReplay")}
                  className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="size-4" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (voice) stopNarration();
                setVoice(!voice);
              }}
              aria-pressed={voice}
              aria-label={voice ? t("msVoiceOn") : t("msVoiceOff")}
              title={voice ? t("msVoiceOn") : t("msVoiceOff")}
              className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          </div>
        </div>

        {/* the assistant's screen plays the scene; it stays up, settled, while a decision is on */}
        {scene.screen && (b.t === "scene" || b.t === "moment" || b.t === "why") ? (
          <div className="pointer-events-none absolute inset-x-3 top-10 bottom-[44%] sm:inset-x-auto sm:top-[13%] sm:right-[3%] sm:bottom-[9%] sm:w-[44%]">
            <MissionScreen key={`screen-${sceneNo}`} screen={scene.screen} settled={b.t !== "scene"} waitingLabel={t("msWaiting")} />
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {b.t === "open" ? (
            <motion.div key="open" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
              <div className="text-xs tracking-[0.25em] text-white/60 uppercase">{mission.setting}</div>
              <h2 className="font-serif text-3xl font-semibold text-balance sm:text-5xl">{mission.title}</h2>
              <div className="text-sm text-white/70">{t("msWith", { name: mission.cast.name, role: mission.cast.role })}</div>
            </motion.div>
          ) : b.t === "card" ? (
            <motion.div key={`card-${sceneNo}`} className="flex flex-1 flex-col items-center justify-center gap-2 bg-black/50 px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
              <div className="text-xs tracking-[0.25em] text-white/60 uppercase">{t(exec ? "msBrief" : "msScene", { n: sceneNo + 1, total })}</div>
              <h2 className="font-serif text-3xl font-semibold sm:text-4xl">{scene.heading}</h2>
            </motion.div>
          ) : (
            <motion.div key={`line-${beat}`} className={cn("mt-auto flex flex-col gap-1.5 px-4 pb-4 sm:px-8 sm:pb-6", scene.screen && "sm:max-w-[54%]")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              {speaker ? <div className="text-xs font-semibold tracking-wide text-white/70">{speaker}</div> : null}
              <p className={cn("max-w-3xl text-pretty text-white drop-shadow", b.t === "scene" ? "text-base italic sm:text-lg" : "text-lg font-medium sm:text-xl")}>
                {reduce
                  ? line
                  : line.split(" ").map((w, i) => (
                      <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.045 }}>
                        {w}{" "}
                      </motion.span>
                    ))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </MissionStage>

      {/* the decision panel: the assistant's screen, under the frame */}
      <div className="-mt-3 rounded-b-card border border-t-0 border-line bg-panel px-4 pt-6 pb-4 sm:px-6">
        <div className="mb-4 flex gap-1" aria-hidden>
          {Array.from({ length: mission.scenes.flatMap((s) => s.moments).length }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i < given.length ? "bg-brand" : i === momentIndex ? "bg-brand/50" : "bg-line")} />
          ))}
        </div>

        {finishing !== "idle" ? (
          <div className="flex items-center gap-3 py-2 text-sm" aria-live="polite">
            {finishing === "busy" ? (
              <span className="text-ink-muted">{t("msFinishing")}</span>
            ) : (
              <>
                <span className="text-err">{t("msError")}</span>
                <Button size="sm" variant="outline" onClick={() => void finish(given, why)}>
                  {t("msRetry")}
                </Button>
              </>
            )}
          </div>
        ) : b.t === "moment" ? (
          <div className="flex flex-col gap-3" key={b.moment.id}>
            <div className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {b.moment.kind === "reply" ? t("msReply", { name: mission.cast.name }) : b.moment.kind === "instruct" ? t("msInstruct") : t("msApprove")}
            </div>
            <div role="radiogroup" aria-label={b.moment.prompt} className={cn("grid gap-2", b.moment.kind === "approve" && "sm:grid-cols-3")}>
              {b.moment.options.map((o, i) => {
                const on = picked === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={o.text}
                    onClick={() => choose(o.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-card border px-4 py-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                      b.moment.kind === "reply" && "rounded-2xl rounded-bl-md",
                      b.moment.kind === "instruct" && "font-mono text-[13px]",
                      on ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line bg-panel-2/60 hover:border-brand-line",
                    )}
                  >
                    {b.moment.kind === "approve" ? <span className="text-xs font-semibold text-ink-faint">{t("msPlan", { n: i + 1 })}</span> : b.moment.kind === "instruct" ? <span className="text-ink-faint">›</span> : null}
                    <span className="flex-1">{o.text}</span>
                    {on ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
            {/* actions sit on the left, clear of the floating companion */}
            <div className="flex items-center gap-4">
              <Button variant="brand" disabled={!picked} onClick={() => confirm(picked)}>
                {exec ? t("msDecide") : t("msConfirm")}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <button type="button" onClick={() => confirm(null)} className="text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline">
                {t("msNotSure")}
              </button>
            </div>
          </div>
        ) : b.t === "why" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitWhy(false);
            }}
          >
            <label htmlFor="ms-why" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t("msWhyLabel")}
            </label>
            <div className="flex gap-2">
              <Textarea
                id="ms-why"
                autoFocus
                rows={2}
                maxLength={600}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={listening ? t("discListening") : t("msWhyPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitWhy(false);
                  }
                }}
              />
              {canListen ? (
                <Button type="button" size="icon-lg" variant={listening ? "brand" : "outline"} onClick={toggleMic} aria-label={listening ? t("discMicStop") : t("discMic")} title={listening ? t("discMicStop") : t("discMic")}>
                  {listening ? <MicOff /> : <Mic />}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit" variant="brand" disabled={!draft.trim()}>
                {t("msConfirm")}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <button type="button" onClick={() => submitWhy(true)} className="text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline">
                {t("skip")}
              </button>
            </div>
          </form>
        ) : b.t === "card" ? (
          <div className="h-10" />
        ) : (
          <div className="flex">
            <Button variant="outline" className="bg-transparent" onClick={() => next()}>
              {t("msContinue")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
