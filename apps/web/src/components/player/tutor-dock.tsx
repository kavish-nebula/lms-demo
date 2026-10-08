"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked, Lock, Mic, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/kit/chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ModuleContent, Topic } from "@/data/types";

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; citations?: string[]; kind?: "answer" | "outside" | "locked" };

type Chunk = { text: string; source: string };

const STOP = new Set(["what", "does", "this", "that", "with", "from", "have", "your", "about", "when", "which", "there", "would", "could", "should", "into", "why", "how", "the", "and", "for", "are", "you", "can"]);

function words(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9()]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Course-scoped retrieval stand-in: chunks are the module's own published
 * text, cited by topic title (never by method name).
 */
function buildIndex(mod: ModuleContent, topics: Topic[]): Chunk[] {
  const title = (stage: string) => topics.find((t) => t.stage === stage)?.title ?? mod.title;
  const chunks: Chunk[] = [];
  for (const b of mod.blocks) {
    if (b.stage === "hook") chunks.push({ text: `${b.why} ${b.wrap_point}`, source: title("hook") });
    if (b.stage === "explainer" && b.videos?.length)
      for (const v of b.videos) {
        for (const s of v.slides) chunks.push({ text: s.narration, source: `${v.lesson} ${v.title} · ${s.title}` });
        chunks.push({ text: v.notes.join(" "), source: `${v.lesson} ${v.title} · key ideas` });
      }
    else if (b.stage === "explainer")
      for (const s of b.segments) {
        for (const beat of s.beats) chunks.push({ text: beat.narration, source: `${s.lesson} ${s.title}` });
        chunks.push({ text: s.notes.join(" "), source: `${s.lesson} ${s.title} · key ideas` });
      }
    if (b.stage === "worked")
      for (const e of b.examples) chunks.push({ text: e.narration, source: `${title("worked")} · ${e.title}` });
    if (b.stage === "guided") {
      chunks.push({ text: b.situation, source: title("guided") });
      b.steps.forEach((st, i) =>
        chunks.push({ text: [st.body, ...st.actions, st.check, st.tip ?? ""].join(" ").replace(/\*\*|`/g, ""), source: `${title("guided")} · ${i + 1}. ${st.title}` }),
      );
    }
  }
  return chunks;
}

function answer(query: string, index: Chunk[]) {
  const q = new Set(words(query));
  let best: { chunk: Chunk; score: number } | null = null;
  for (const c of index) {
    const score = words(c.text).filter((w) => q.has(w)).length;
    if (!best || score > best.score) best = { chunk: c, score };
  }
  return best && best.score >= 1 ? best.chunk : null;
}

/**
 * Course tutor (ARCHITECTURE.pdf section 8). Floating glass dock: discloses it
 * is an AI, answers only from this course with citations, says so when nothing
 * matches, and locks while a mastery gate is open. Memory is this session only.
 */
export function TutorDock({ module, topics, locked }: { module: ModuleContent; topics: Topic[]; locked: boolean }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const index = React.useMemo(() => buildIndex(module, topics), [module, topics]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const idRef = React.useRef(0);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, thinking]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setInput("");
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", text: q }]);
    setThinking(true);
    setTimeout(() => {
      const hit = locked ? null : answer(q, index);
      setMessages((m) => [
        ...m,
        locked
          ? { id: ++idRef.current, role: "assistant", kind: "locked", text: t("tutorGateLocked") }
          : hit
            ? { id: ++idRef.current, role: "assistant", kind: "answer", text: hit.text, citations: [hit.source] }
            : { id: ++idRef.current, role: "assistant", kind: "outside", text: t("tutorOutside") },
      ]);
      setThinking(false);
    }, 700);
  }

  function mic() {
    let consent = false;
    try {
      consent = !!JSON.parse(localStorage.getItem("lms-prefs") ?? "{}").microphone;
    } catch {}
    if (!consent) setConsentOpen(true);
    else toast.info(t("voiceSoon"));
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t("tutor")}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass glass-lg fixed inset-x-3 bottom-3 z-40 flex max-h-[min(640px,78dvh)] flex-col overflow-hidden rounded-card-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px]"
          >
            <header className="flex items-center gap-3 border-b border-glass-border px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-deep text-on-brand">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {t("tutor")}
                  <Chip size="sm" tone="accent">AI</Chip>
                </div>
                <div className="truncate text-xs text-ink-muted">{module.title}</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label={tc("close")}>
                <X />
              </Button>
            </header>

            <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-panel/70 px-4 py-4" aria-live="polite">
              <p className="rounded-lg bg-panel-2/80 p-3 text-xs text-ink-muted">{tc("aiDisclosure")}</p>
              {locked ? (
                <div className="flex items-start gap-2 rounded-lg border border-warn-line bg-warn-soft p-3 text-sm">
                  <Lock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                  {t("tutorGateLocked")}
                </div>
              ) : null}
              {messages.length === 0 && !locked ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-ink-faint">{t("tryAsking")}</div>
                  {[t("suggest1"), t("suggest2"), t("suggest3")].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-lg border border-line bg-panel px-3 py-2 text-left text-sm hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {thinking ? (
                <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-panel px-3 py-3 shadow-sm" aria-label={t("thinking")}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-ink-faint"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <form
              className="flex items-center gap-2 border-t border-glass-border bg-panel/80 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={locked ? t("tutorLockedPlaceholder") : t("tutorPlaceholder")}
                disabled={locked}
                aria-label={t("tutorPlaceholder")}
                className="h-10"
              />
              <Button type="button" variant="ghost" size="icon" onClick={mic} disabled={locked} aria-label={t("voice")}>
                <Mic />
              </Button>
              <Button type="submit" size="icon" disabled={locked || !input.trim() || thinking} aria-label={t("send")}>
                <Send />
              </Button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {!open ? (
        <Button
          variant="glass"
          size="xl"
          className="fixed right-5 bottom-5 z-40 rounded-pill pr-5"
          onClick={() => setOpen(true)}
          aria-label={t("openTutor")}
        >
          <Sparkles data-icon="inline-start" />
          {t("tutor")}
          {locked ? <Lock className="size-4 text-ink-faint" aria-hidden /> : null}
        </Button>
      ) : null}

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("micTitle")}</DialogTitle>
            <DialogDescription>{t("micConsent")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("notNow")}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                onClick={() => {
                  try {
                    const p = JSON.parse(localStorage.getItem("lms-prefs") ?? "{}");
                    localStorage.setItem("lms-prefs", JSON.stringify({ ...p, microphone: true }));
                  } catch {}
                  toast.info(t("voiceSoon"));
                }}
              >
                {t("allowMic")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const t = useTranslations("player");
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-deep px-3.5 py-2.5 text-sm text-on-brand">
        {message.text}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm shadow-sm",
        message.kind === "outside" ? "border border-line bg-panel-2" : "bg-panel",
      )}
    >
      <p className="leading-relaxed">{message.text}</p>
      {message.citations?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-xs text-ink-muted">
          <BookMarked className="size-3.5" aria-hidden />
          <span>{t("tutorSources")}:</span>
          {message.citations.map((c) => (
            <span key={c} className="font-medium text-brand-ink">
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
