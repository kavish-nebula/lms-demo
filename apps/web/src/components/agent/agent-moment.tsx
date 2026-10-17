"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartIcon } from "@/components/agent/agent-blueprint";
import { useAgentVoice } from "@/components/agent/agent-voice";
import { useHydrated, useLocalString, writeLocal } from "@/lib/local-store";
import { partBuiltLine, type AgentBlueprint } from "@/lib/agent-build";

/**
 * The moment a module's part is added to the learner's agent: the part
 * snaps in and the agent says what it can do now. Shown once per part
 * (remembered per course in this browser); when several parts are new at
 * once (a returning learner), only the latest is shown.
 */
export function AgentMoment({ courseId, agent }: { courseId: string; agent: AgentBlueprint }) {
  const t = useTranslations("agent");
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const key = `knowlab.agent.shown.${courseId}`;
  const shown = new Set((useLocalString(key) ?? "").split(",").filter(Boolean));
  const built = agent.parts.filter((p) => p.state === "built");
  const fresh = [...built].reverse().find((p) => !shown.has(p.key));
  const builtKeys = built.map((p) => p.key).join(",");
  // closing marks every built part as seen; it also closes by itself after a few seconds
  const close = () => writeLocal(key, builtKeys);
  const freshKey = fresh?.key;
  const { say } = useAgentVoice();
  React.useEffect(() => {
    const line = freshKey ? partBuiltLine(freshKey) : null;
    if (freshKey && line) say(line, { once: `${courseId}.part.${freshKey}` });
  }, [freshKey, courseId, say]);
  React.useEffect(() => {
    if (!freshKey) return;
    const id = window.setTimeout(() => writeLocal(key, builtKeys), 6000);
    return () => window.clearTimeout(id);
  }, [freshKey, key, builtKeys]);

  if (!hydrated) return null;
  // rendered at the top of the page, so nothing on the lesson page can clip or cover it
  return createPortal(
    <AnimatePresence>
      {fresh ? (
        <motion.div
          key={fresh.key}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-moment-title"
            className="flex w-full max-w-sm flex-col items-center gap-3 rounded-card border border-brand-line bg-panel p-6 text-center shadow-2xl"
            initial={reduce ? false : { y: 16, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex size-20 items-center justify-center">
              {!reduce ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-brand/30"
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeOut", delay: 0.35 }}
                />
              ) : null}
              <motion.span
                className="relative flex size-16 items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_0_30px_var(--accent-soft)]"
                initial={reduce ? false : { scale: 1.8, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
              >
                <PartIcon part={fresh.key} className="size-7" />
              </motion.span>
            </div>
            <div className="text-xs font-semibold tracking-wide text-brand-ink uppercase">{t("newPart")}</div>
            <h2 id="agent-moment-title" className="text-xl font-semibold text-balance">
              {t("installed", { part: fresh.label, name: agent.name ?? t("label") })}
            </h2>
            {partBuiltLine(fresh.key) ? <p className="text-sm text-ink-muted">“{partBuiltLine(fresh.key)}”</p> : null}
            <p className="text-xs text-ink-faint">{t("partsBuilt", { n: agent.builtCount, total: agent.parts.length })}</p>
            <Button variant="brand" onClick={close} autoFocus>
              {t("keepGoing")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
