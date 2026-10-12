"use client";

import "./guide-sim.css";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useReducedMotionConfig } from "motion/react";
import { Check, FileCode2, Keyboard, Lightbulb, MessageSquare, Play, SendHorizontal, Signpost, SquareTerminal } from "lucide-react";
import type { GuideSim, SimRun } from "@/data/types";

/**
 * The practice simulator for guided practice: a small laptop window where the
 * learner does the step instead of reading about it. Type the commands into a
 * terminal that answers back; fill the blanks in the key lines of a file and
 * press Run; start Scout and chat with it while its tool calls scroll past;
 * or make the call on a decision. `onSlip` reports a mistake or a hint (the
 * step then earns no bonus); `onSolved` reports the step done. `solved` shows
 * the finished state straight away.
 */
export function Simulator({ sim, solved, onSolved, onSlip }: { sim: GuideSim; solved: boolean; onSolved: () => void; onSlip: () => void }) {
  switch (sim.kind) {
    case "terminal":
      return <TerminalSim sim={sim} solved={solved} onSolved={onSolved} onSlip={onSlip} />;
    case "code":
      return <CodeSim sim={sim} solved={solved} onSolved={onSolved} onSlip={onSlip} />;
    case "chat":
      return <ChatSim sim={sim} solved={solved} onSolved={onSolved} />;
    case "choice":
      return <ChoiceSim sim={sim} solved={solved} onSolved={onSolved} onSlip={onSlip} />;
  }
}

type Sim<K extends GuideSim["kind"]> = Extract<GuideSim, { kind: K }>;

function Window({ icon, title, tools, children }: { icon: React.ReactNode; title: string; tools?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="gs-win">
      <div className="gs-bar">
        <span className="gs-lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="gs-tab">
          <span className="[&_svg]:size-3.5" aria-hidden>
            {icon}
          </span>
          {title}
        </span>
        {tools ? <span className="gs-tools">{tools}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Lines of output appearing one after another, as a real program prints them. */
function Printed({ text, className, onDone }: { text: string; className?: string; onDone?: () => void }) {
  const reduce = useReducedMotionConfig() ?? false;
  const lines = text ? text.split("\n") : [];
  const [n, setN] = React.useState(reduce ? lines.length : 0);
  const done = React.useRef(onDone);
  React.useEffect(() => {
    done.current = onDone;
  });
  React.useEffect(() => {
    if (n >= lines.length) {
      done.current?.();
      return;
    }
    const id = window.setTimeout(() => setN((x) => x + 1), 70);
    return () => window.clearTimeout(id);
  }, [n, lines.length]);
  return lines.length ? <div className={className ?? "gs-out"}>{lines.slice(0, n).join("\n")}</div> : null;
}

/** Text typed out character by character (a reply being written). */
function Typed({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduce = useReducedMotionConfig() ?? false;
  const [n, setN] = React.useState(reduce ? text.length : 0);
  const done = React.useRef(onDone);
  React.useEffect(() => {
    done.current = onDone;
  });
  React.useEffect(() => {
    if (n >= text.length) {
      done.current?.();
      return;
    }
    const id = window.setTimeout(() => setN((x) => Math.min(text.length, x + 3)), 16);
    return () => window.clearTimeout(id);
  }, [n, text.length]);
  return <>{text.slice(0, n)}</>;
}

const same = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/* ------------------------------------------------------------------ terminal */

type Entry = { ok: boolean; prompt: string; cmd: string; out?: string };

function TerminalSim({ sim, solved, onSolved, onSlip }: { sim: Sim<"terminal">; solved: boolean; onSolved: () => void; onSlip: () => void }) {
  const t = useTranslations("sim");
  const promptAt = (i: number) => sim.lines.slice(0, i).reduce((p, l) => l.prompt ?? p, sim.prompt);
  const [at, setAt] = React.useState(solved ? sim.lines.length : 0);
  const [log, setLog] = React.useState<Entry[]>(() => (solved ? sim.lines.map((l, i) => ({ ok: true, prompt: promptAt(i), cmd: l.cmd, out: l.out })) : []));
  const [value, setValue] = React.useState("");
  const [hint, setHint] = React.useState(false);
  const [shake, setShake] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const typing = React.useRef<number | null>(null);
  const line = sim.lines[at];
  const prompt = promptAt(at);

  React.useEffect(() => {
    if (!solved) input.current?.focus({ preventScroll: true });
    return () => {
      if (typing.current) window.clearInterval(typing.current);
    };
  }, [solved]);
  React.useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [log, at]);

  const accept = (cmd: string) => {
    if (!line) return;
    setLog((l) => [...l, { ok: true, prompt, cmd, out: line.out }]);
    setValue("");
    setHint(false);
    setAt(at + 1);
    if (at + 1 === sim.lines.length) onSolved();
  };
  const submit = () => {
    if (!line || !value.trim()) return;
    if ([line.cmd, ...(line.alt ?? [])].some((c) => same(value, c))) return accept(value.trim());
    setLog((l) => [...l, { ok: false, prompt, cmd: value.trim() }]);
    setValue("");
    setShake((s) => s + 1);
    if (!hint) onSlip();
    setHint(true);
  };
  const showHint = () => {
    if (!hint) onSlip();
    setHint(true);
    input.current?.focus({ preventScroll: true });
  };
  const typeForMe = () => {
    if (!line || typing.current) return;
    if (!hint) onSlip();
    setHint(true);
    let i = 0;
    typing.current = window.setInterval(() => {
      i += 2;
      setValue(line.cmd.slice(0, i));
      if (i >= line.cmd.length) {
        window.clearInterval(typing.current!);
        typing.current = null;
        window.setTimeout(() => accept(line.cmd), 250);
      }
    }, 30);
  };

  return (
    <Window
      icon={<SquareTerminal />}
      title={t("terminal")}
      tools={
        line ? (
          <>
            <button type="button" className="gs-tool" onClick={showHint}>
              <Lightbulb aria-hidden />
              {t("hint")}
            </button>
            <button type="button" className="gs-tool" onClick={typeForMe}>
              <Keyboard aria-hidden />
              {t("typeForMe")}
            </button>
          </>
        ) : null
      }
    >
      <div ref={box} className="gs-term" onClick={() => input.current?.focus({ preventScroll: true })} role="log" aria-label={t("terminal")}>
        {log.map((e, i) => (
          <div key={i} className="gs-line">
            <span className="gs-prompt">{e.prompt}</span> <span className="gs-cmd">{e.cmd}</span>
            {e.ok ? (
              e.out ? <Printed text={e.out} /> : null
            ) : (
              <div className="gs-err">{t("wrongCommand")}</div>
            )}
          </div>
        ))}
        {line ? (
          <div key={shake} className={shake ? "gs-inputrow gs-shake" : "gs-inputrow"}>
            <span className="gs-prompt">{prompt}</span>
            <span className="gs-inputwrap">
              {hint ? <span className="gs-ghost" aria-hidden>{line.cmd}</span> : null}
              <input
                ref={input}
                className="gs-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  else if (e.key === "Tab") {
                    e.preventDefault();
                    if (!hint) onSlip();
                    setHint(true);
                    setValue(line.cmd);
                  }
                }}
                aria-label={t("typeHere")}
                placeholder={log.length || hint ? "" : t("typeHere")}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
            </span>
          </div>
        ) : (
          <div className="gs-ok mt-1">
            <Check className="mr-1 inline size-3.5" aria-hidden />
            {t("allRan")}
          </div>
        )}
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ editor */

type Part = { text: string } | { blank: number };

/** The file split into lines of text and blanks; each blank is the token's first appearance. */
function partsOf(code: string, blanks: { token: string }[]) {
  const spots = blanks
    .map((b, i) => ({ i, at: code.indexOf(b.token), len: b.token.length }))
    .filter((s) => s.at >= 0)
    .sort((a, b) => a.at - b.at)
    .filter((s, k, all) => k === 0 || s.at >= all[k - 1]!.at + all[k - 1]!.len);
  const flat: Part[] = [];
  let pos = 0;
  for (const s of spots) {
    flat.push({ text: code.slice(pos, s.at) }, { blank: s.i });
    pos = s.at + s.len;
  }
  flat.push({ text: code.slice(pos) });
  const lines: Part[][] = [[]];
  for (const p of flat) {
    if ("blank" in p) lines.at(-1)!.push(p);
    else
      p.text.split("\n").forEach((chunk, k) => {
        if (k > 0) lines.push([]);
        if (chunk) lines.at(-1)!.push({ text: chunk });
      });
  }
  return { lines, order: spots.map((s) => s.i) };
}

const KEYWORDS = /\b(def|import|from|return|for|if|elif|else|in|with|as|class|while|try|except|raise|not|and|or|True|False|None|lambda|async|await|pass)\b/;

/** Light colouring: comments, strings, keywords. */
function Highlighted({ text }: { text: string }) {
  const hash = text.indexOf("#");
  const body = hash >= 0 && !/["']/.test(text.slice(0, hash).replace(/(["'])(?:(?!\1).)*\1/g, "")) ? text.slice(0, hash) : text;
  const comment = body === text ? "" : text.slice(body.length);
  const pieces = body.split(/("[^"]*"|'[^']*')/g);
  return (
    <>
      {pieces.map((p, i) =>
        /^["']/.test(p) ? (
          <span key={i} className="gs-c-str">
            {p}
          </span>
        ) : (
          p.split(KEYWORDS).map((w, j) =>
            KEYWORDS.test(w) && w.length > 1 ? (
              <span key={`${i}-${j}`} className="gs-c-kw">
                {w}
              </span>
            ) : (
              <React.Fragment key={`${i}-${j}`}>{w}</React.Fragment>
            ),
          )
        ),
      )}
      {comment ? <span className="gs-c-com">{comment}</span> : null}
    </>
  );
}

/** A fixed shuffle so the right option is not always first. */
function shuffle<T>(list: T[], seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return [...list].sort((a, b) => ((Math.imul(h ^ String(a).length, 2654435761) >>> 0) % 997) - ((Math.imul(h ^ String(b).length * 7, 2654435761) >>> 0) % 997) || String(a).localeCompare(String(b)));
}

function CodeSim({ sim, solved, onSolved, onSlip }: { sim: Sim<"code">; solved: boolean; onSolved: () => void; onSlip: () => void }) {
  const t = useTranslations("sim");
  const { lines, order } = React.useMemo(() => partsOf(sim.code, sim.blanks), [sim.code, sim.blanks]);
  const [filled, setFilled] = React.useState<number[]>(solved ? order : []);
  const [wrong, setWrong] = React.useState<string[]>([]);
  const [hinted, setHinted] = React.useState(false);
  const [ran, setRan] = React.useState(solved);
  const [shake, setShake] = React.useState(0);
  const active = order.find((i) => !filled.includes(i));
  const blank = active != null ? sim.blanks[active] : undefined;
  const options = React.useMemo(() => (blank ? shuffle(blank.options, blank.token) : []), [blank]);
  const allFilled = active == null;

  const pick = (opt: string) => {
    if (!blank || active == null) return;
    if (opt === blank.token) {
      const next = [...filled, active];
      setFilled(next);
      setWrong([]);
      setHinted(false);
      if (order.every((i) => next.includes(i)) && !sim.run) onSolved();
    } else {
      setWrong((w) => [...w, opt]);
      setShake((s) => s + 1);
      onSlip();
    }
  };

  return (
    <Window
      icon={<FileCode2 />}
      title={sim.file}
      tools={
        blank ? (
          <button
            type="button"
            className="gs-tool"
            onClick={() => {
              if (!hinted) onSlip();
              setHinted(true);
            }}
          >
            <Lightbulb aria-hidden />
            {t("hint")}
          </button>
        ) : null
      }
    >
      <div className="gs-code" aria-label={sim.file}>
        {lines.map((parts, li) => (
          <div key={li} className="gs-row">
            <span className="gs-ln">{li + 1}</span>
            <span className="gs-src">
              {parts.map((p, k) =>
                "text" in p ? (
                  <Highlighted key={k} text={p.text} />
                ) : (
                  <span
                    key={k}
                    className={p.blank === active && shake ? "gs-slot gs-shake" : "gs-slot"}
                    data-active={p.blank === active}
                    data-filled={filled.includes(p.blank)}
                    aria-label={filled.includes(p.blank) ? sim.blanks[p.blank]!.token : t("blank")}
                  >
                    {filled.includes(p.blank) ? sim.blanks[p.blank]!.token : "_".repeat(Math.max(3, sim.blanks[p.blank]!.token.length))}
                  </span>
                ),
              )}
            </span>
          </div>
        ))}
      </div>
      {blank ? (
        <div className="gs-picker" key={`${active}-${shake}`}>
          <span className="gs-picker-label">{t("fillBlank", { n: filled.length + 1, total: order.length })}</span>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={wrong.includes(o) ? "gs-chip gs-shake" : "gs-chip"}
              data-wrong={wrong.includes(o)}
              disabled={wrong.includes(o)}
              style={hinted && o === blank.token ? { borderColor: "#7ee2b8", boxShadow: "0 0 0 3px rgba(126,226,184,0.2)" } : undefined}
              onClick={() => pick(o)}
            >
              {o}
            </button>
          ))}
        </div>
      ) : sim.run ? (
        <div className="gs-split">
          {!ran ? (
            <div className="gs-picker">
              <span className="gs-picker-label">{t("allFilled")}</span>
              <button type="button" className="gs-run" onClick={() => setRan(true)} autoFocus>
                <Play aria-hidden />
                {t("run", { cmd: sim.run.cmd })}
              </button>
            </div>
          ) : (
            <RunOutput run={sim.run} onDone={solved ? undefined : onSolved} />
          )}
        </div>
      ) : allFilled ? (
        <div className="gs-picker gs-ok">
          <Check className="size-4" aria-hidden />
          {t("fileDone")}
        </div>
      ) : null}
    </Window>
  );
}

function RunOutput({ run, onDone }: { run: SimRun; onDone?: () => void }) {
  return (
    <div className="gs-term" style={{ minHeight: 0 }}>
      <div className="gs-line">
        <span className="gs-prompt">&gt;</span> <span className="gs-cmd">{run.cmd}</span>
      </div>
      <Printed text={run.out} onDone={onDone} />
    </div>
  );
}

/* ------------------------------------------------------------------ chat with Scout */

function ChatSim({ sim, solved, onSolved }: { sim: Sim<"chat">; solved: boolean; onSolved: () => void }) {
  const t = useTranslations("sim");
  const [started, setStarted] = React.useState(solved);
  const [booted, setBooted] = React.useState(solved);
  const [turn, setTurn] = React.useState(solved ? sim.turns.length : 0);
  const [sent, setSent] = React.useState(false);
  const [traced, setTraced] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const current = sim.turns[turn];

  React.useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  });
  // the trace scrolls past line by line, then Scout replies
  React.useEffect(() => {
    if (!sent || !current) return;
    const lines = current.trace?.length ?? 0;
    if (traced >= lines) return;
    const id = window.setTimeout(() => setTraced((x) => x + 1), 420);
    return () => window.clearTimeout(id);
  }, [sent, traced, current]);

  const replied = () => {
    setSent(false);
    setTraced(0);
    setTurn((x) => x + 1);
    if (turn + 1 === sim.turns.length) onSolved();
  };

  return (
    <Window icon={<MessageSquare />} title={t("scoutTerminal")}>
      <div ref={box} className="gs-term" role="log" aria-label={t("scoutTerminal")}>
        {started ? (
          <div className="gs-line">
            <span className="gs-prompt">&gt;</span> <span className="gs-cmd">{sim.start.cmd}</span>
            <Printed text={sim.start.out} className="gs-note" onDone={() => setBooted(true)} />
          </div>
        ) : (
          <div className="gs-note">{t("notStarted")}</div>
        )}
        {sim.turns.slice(0, turn).map((tn, i) => (
          <div key={i} className="gs-msg">
            <div className="gs-you">
              <span className="gs-who">{t("you")}</span>
              {tn.you}
            </div>
            {(tn.trace ?? []).map((x, j) => (
              <div key={j} className="gs-trace">
                {x}
              </div>
            ))}
            <div className="gs-scout">
              <span className="gs-who">Scout</span>
              {tn.scout}
            </div>
          </div>
        ))}
        {current && sent ? (
          <div className="gs-msg">
            <div className="gs-you">
              <span className="gs-who">{t("you")}</span>
              {current.you}
            </div>
            {(current.trace ?? []).slice(0, traced).map((x, j) => (
              <div key={j} className="gs-trace">
                {x}
              </div>
            ))}
            {traced >= (current.trace?.length ?? 0) ? (
              <div className="gs-scout">
                <span className="gs-who">Scout</span>
                <Typed text={current.scout} onDone={replied} />
              </div>
            ) : (
              <div className="gs-note">{t("thinking")}</div>
            )}
          </div>
        ) : null}
        {!current && started ? (
          <div className="gs-ok mt-2">
            <Check className="mr-1 inline size-3.5" aria-hidden />
            {t("chatDone")}
          </div>
        ) : null}
      </div>
      {!started ? (
        <div className="gs-compose">
          <span className="gs-note flex-1 font-mono text-[13px]">&gt; {sim.start.cmd}</span>
          <button type="button" className="gs-run" onClick={() => setStarted(true)}>
            <Play aria-hidden />
            {t("startScout")}
          </button>
        </div>
      ) : current && booted && !sent ? (
        <form
          className="gs-compose"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <span className="gs-compose-text" aria-label={t("yourMessage")}>
            {current.you}
          </span>
          <button type="submit" className="gs-send" autoFocus>
            <SendHorizontal aria-hidden />
            {t("send")}
          </button>
        </form>
      ) : null}
    </Window>
  );
}

/* ------------------------------------------------------------------ decision */

function ChoiceSim({ sim, solved, onSolved, onSlip }: { sim: Sim<"choice">; solved: boolean; onSolved: () => void; onSlip: () => void }) {
  const t = useTranslations("sim");
  const [wrong, setWrong] = React.useState<number[]>([]);
  const [right, setRight] = React.useState(solved);
  return (
    <Window icon={<Signpost />} title={t("decision")}>
      <div className="gs-choice">
        <p className="gs-q">{sim.q}</p>
        {sim.options.map((o, i) => {
          const isWrong = wrong.includes(i);
          const isRight = right && i === sim.correct;
          return (
            <button
              key={i}
              type="button"
              className={isWrong ? "gs-opt gs-shake" : "gs-opt"}
              data-state={isRight ? "right" : isWrong ? "wrong" : undefined}
              disabled={right || isWrong}
              onClick={() => {
                if (i === sim.correct) {
                  setRight(true);
                  onSolved();
                } else {
                  setWrong((w) => [...w, i]);
                  onSlip();
                }
              }}
            >
              {o}
            </button>
          );
        })}
        {right ? <p className="gs-explain">{sim.explain}</p> : wrong.length ? <p className="gs-note text-sm">{t("tryAnother")}</p> : null}
      </div>
    </Window>
  );
}
