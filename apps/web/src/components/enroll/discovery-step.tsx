"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Clock3, EyeOff, MessageCircle, Mic, MicOff, Send, Sprout, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCompanionStep } from "@/components/learning/course-companion";
import { api } from "@/lib/api";
import {
  bestLevels,
  MAX_MESSAGE_CHARS,
  summarizeSignals,
  type DiscoveryEvidence,
  type DiscoveryMessage,
  type DiscoveryProfile,
  type DiscoveryScene,
  type DiscoveryTurn,
  type LearningPrefs,
  type ReplyRecord,
} from "@/lib/discovery";
import type { PrecheckResult, SetupAnswers } from "@/lib/setup";
import { recognitionCtor, secondsSince, useCanListen, type Recognition } from "@/lib/speech";

const initials = (name: string) => name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

/**
 * Discovery: replaces the multiple-choice quick check with a short live chat.
 * A colleague from the learner's field (played by Gemini on the server, or a
 * built-in script without a key) talks through real situations; each reply is
 * quiet evidence for one course skill. The result is the quick check's shape
 * (best level per module), so everything after it adapts as before.
 */
export function DiscoveryStep({
  courseId,
  courseTitle,
  answers,
  lessonKeys,
  onDone,
  onQuiz,
}: {
  courseId: string;
  courseTitle: string;
  answers: SetupAnswers;
  /** every module key the quick check covers ("1".."6") */
  lessonKeys: string[];
  onDone: (r: PrecheckResult) => void;
  onQuiz: () => void;
}) {
  const t = useTranslations("enroll");
  useCompanionStep({ title: courseTitle, phase: "precheck", guidance: "Chat with your colleague. There are no wrong answers." });

  const [started, setStarted] = React.useState(false);
  const [messages, setMessages] = React.useState<DiscoveryMessage[]>([]);
  const [evidence, setEvidence] = React.useState<DiscoveryEvidence[]>([]);
  const [scene, setScene] = React.useState<DiscoveryScene | null>(null);
  const [turn, setTurn] = React.useState<DiscoveryTurn | null>(null);
  const [profile, setProfile] = React.useState<DiscoveryProfile | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [readAloud, setReadAloud] = React.useState(false);
  const recognition = React.useRef<Recognition | null>(null);
  // how each reply happened: the evidence for how this learner likes to learn
  const [records, setRecords] = React.useState<ReplyRecord[]>([]);
  const guideAt = React.useRef(0);
  const spoke = React.useRef(false);
  const [learning, setLearning] = React.useState<LearningPrefs | null>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  const canListen = useCanListen();

  const at = () => new Date().toISOString();
  const seen = Object.keys(bestLevels(evidence)).length;

  /** Asks the server for the next turn, given the transcript so far. */
  const ask = React.useCallback(
    async (history: DiscoveryMessage[], soFar: DiscoveryEvidence[], replies: ReplyRecord[]) => {
      setLoading(true);
      setFailed(false);
      try {
        const { turn: next } = await api<{ turn: DiscoveryTurn }>("/api/v1/discovery", {
          method: "POST",
          body: { courseId, answers, messages: history, evidence: soFar, signals: summarizeSignals(replies) },
        });
        const allEvidence = [...soFar, ...next.evidence];
        setEvidence(allEvidence);
        if (next.scene) setScene(next.scene);
        setMessages([...history, { role: "guide", text: next.reply }]);
        guideAt.current = Date.now();
        setTurn(next);
        if (next.done) {
          setProfile(next.profile);
          setLearning(next.learning);
        }
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [courseId, answers],
  );

  // keep the newest message in view
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // read the colleague's replies aloud when asked to
  React.useEffect(() => {
    const last = messages.at(-1);
    if (!readAloud || !last || last.role !== "guide" || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(last.text));
  }, [messages, readAloud]);
  React.useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    recognition.current?.stop();
  }, []);

  function send(text: string, chip = false) {
    const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!clean || loading || turn?.done) return;
    recognition.current?.stop();
    setDraft("");
    const record: ReplyRecord = {
      seconds: guideAt.current ? secondsSince(guideAt.current) : 0,
      words: clean.split(/\s+/).filter(Boolean).length,
      voice: spoke.current,
      chip,
      text: clean,
    };
    spoke.current = false;
    const replies = [...records, record];
    setRecords(replies);
    const history: DiscoveryMessage[] = [...messages, { role: "learner", text: clean }];
    setMessages(history);
    void ask(history, evidence, replies);
  }

  function toggleMic() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    const before = draft ? `${draft} ` : "";
    r.onresult = (e) => {
      let heard = "";
      for (let i = 0; i < e.results.length; i++) heard += e.results[i]?.[0]?.transcript ?? "";
      setDraft(before + heard);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    spoke.current = true;
    setListening(true);
    r.start();
  }

  function finish(p: DiscoveryProfile | null) {
    const levels = bestLevels(evidence);
    onDone({
      at: at(),
      source: "activity",
      lessons: Object.fromEntries(Object.entries(levels).filter(([k]) => lessonKeys.includes(k))),
      activity: { ...(p ?? { summary: t("discEndedSummary"), strengths: [], focus: [] }), ...(learning ? { learning } : {}) },
    });
  }

  /* ---------------- intro ---------------- */
  if (!started) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("discKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("discTitle")}</h1>
          <p className="mt-3 text-ink-muted">{t("discBody")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Clock3 />, text: t("discTime") },
            { icon: <MessageCircle />, text: t("discTalk") },
            { icon: <EyeOff />, text: t("discNoScore") },
          ].map((r) => (
            <li key={r.text} className="flex items-center gap-2.5 rounded-lg border border-line bg-panel-2/60 p-3 text-sm">
              <span className="shrink-0 text-brand-ink [&_svg]:size-4">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant="brand"
            onClick={() => {
              setStarted(true);
              void ask([], [], []);
            }}
          >
            {t("discStart")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button size="lg" variant="outline" className="bg-transparent" onClick={() => onDone({ at: at(), isNew: true, lessons: Object.fromEntries(lessonKeys.map((l) => [l, 0])) })}>
            <Sprout data-icon="inline-start" />
            {t("precheckNew")}
          </Button>
          <Button variant="ghost" onClick={() => onDone({ at: at(), skipped: true, lessons: {} })}>
            {t("precheckSkip")}
          </Button>
        </div>
        <button type="button" onClick={onQuiz} className="w-fit text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline">
          {t("discQuiz")}
        </button>
      </div>
    );
  }

  /* ---------------- starting point ---------------- */
  if (turn?.done && profile) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("discDoneKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("discDoneTitle")}</h1>
          <p className="mt-3 text-ink-muted">{profile.summary}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: t("discKnow"), items: profile.strengths, tone: "text-ok" },
            { title: t("discHelp"), items: profile.focus, tone: "text-brand-ink" },
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
        {learning ? (
          <section className="rounded-card border border-brand-line bg-brand-soft/60 p-4">
            <h2 className="text-sm font-semibold text-brand-ink">{t("discLearnStyle")}</h2>
            <p className="mt-1 text-sm">{learning.note}</p>
          </section>
        ) : null}
        <p className="text-sm text-ink-faint">{t("discAdapts")}</p>
        <Button size="lg" variant="brand" className="w-fit" onClick={() => finish(profile)}>
          {t("discContinue")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </motion.div>
    );
  }

  /* ---------------- the chat ---------------- */
  const who = scene?.character ?? "…";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-ink" aria-hidden>
          {scene ? initials(scene.character) : <MessageCircle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{scene ? `${scene.character} · ${scene.characterRole}` : t("discTitle")}</div>
          {scene ? <div className="truncate text-sm text-ink-muted">{scene.title}</div> : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={readAloud}
          aria-label={t("discReadAloud")}
          title={t("discReadAloud")}
          onClick={() => {
            setReadAloud((v) => !v);
            if (readAloud && "speechSynthesis" in window) window.speechSynthesis.cancel();
          }}
        >
          {readAloud ? <Volume2 /> : <VolumeX />}
        </Button>
      </header>

      {scene ? <p className="rounded-lg border border-line bg-panel-2/60 px-3 py-2 text-sm text-ink-muted">{scene.setting}</p> : null}

      <div ref={logRef} role="log" aria-live="polite" className="flex max-h-[55vh] min-h-64 flex-col gap-3 overflow-y-auto rounded-card border border-line bg-panel p-4">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                m.role === "guide" ? "self-start rounded-bl-md bg-panel-2" : "self-end rounded-br-md bg-brand text-on-brand",
              )}
            >
              <span className="sr-only">{m.role === "guide" ? who : t("discYou")}: </span>
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading ? (
          <div className="self-start rounded-2xl rounded-bl-md bg-panel-2 px-4 py-3" aria-label={t("discTyping", { name: who })}>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-faint" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </span>
          </div>
        ) : null}
        {failed ? (
          <div className="flex items-center gap-3 self-start text-sm text-err">
            {t("discError")}
            <Button size="sm" variant="outline" onClick={() => void ask(messages, evidence, records)}>
              {t("discRetry")}
            </Button>
          </div>
        ) : null}
      </div>

      {turn?.quickReplies.length && !loading && !turn.done ? (
        <div className="flex flex-wrap gap-2">
          {turn.quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q, true)}
              className="rounded-pill border border-line bg-panel px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-brand-line hover:text-ink"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          placeholder={listening ? t("discListening") : t("discPlaceholder")}
          aria-label={t("discPlaceholder")}
          disabled={!messages.length || turn?.done}
          className="min-h-12 flex-1 resize-none"
        />
        {canListen ? (
          <Button
            type="button"
            size="icon-lg"
            variant={listening ? "brand" : "outline"}
            aria-pressed={listening}
            aria-label={listening ? t("discMicStop") : t("discMic")}
            title={listening ? t("discMicStop") : t("discMic")}
            onClick={toggleMic}
            disabled={!messages.length || turn?.done}
          >
            {listening ? <MicOff /> : <Mic />}
          </Button>
        ) : null}
        <Button type="submit" size="icon-lg" variant="brand" aria-label={t("discSend")} disabled={!draft.trim() || loading || !messages.length || turn?.done}>
          <Send />
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-ink-faint" aria-live="polite">
          {t("discExplored", { seen, total: lessonKeys.length })}
          {turn?.source === "script" ? ` · ${t("discOffline")}` : ""}
        </span>
        <span className="flex gap-4">
          <button type="button" onClick={onQuiz} className="text-ink-faint underline-offset-4 hover:text-ink hover:underline">
            {t("discQuiz")}
          </button>
          <button type="button" onClick={() => finish(turn?.done ? profile : null)} className="text-ink-faint underline-offset-4 hover:text-ink hover:underline">
            {t("discEnd")}
          </button>
        </span>
      </div>
    </div>
  );
}
