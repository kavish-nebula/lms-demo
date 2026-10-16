"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AssistantAvatar } from "@/components/learning/assistant-avatar";
import { writeLocal } from "@/lib/local-store";

/** Seen once per browser; Settings can clear it to replay. */
export const TOUR_KEY = "lms-tour:v1";

const seen = () => {
  try {
    return !!localStorage.getItem(TOUR_KEY);
  } catch {
    return true; // storage blocked: never nag
  }
};

const STOPS = [
  { target: "progress", title: "progressTitle", body: "progressBody" },
  { target: "roadmap", title: "roadmapTitle", body: "roadmapBody" },
  { target: "pip", title: "pipTitle", body: "pipBody" },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Pip's welcome tour: three stops on the course page, the first time an
 * enrolled learner opens it. Each stop rings an element marked
 * `data-tour="…"`; stops whose element isn't on screen are left out. It
 * never comes back on its own (the one exception to "Pip never pops up
 * unasked"), can be skipped with Esc, and moves focus into its card.
 * `?tour=1` on the course page opens it again.
 */
export function PipTour({ enabled }: { enabled: boolean }) {
  const t = useTranslations("tour");
  const [open, setOpen] = React.useState(false);
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // ?tour=1 opens it on request (a "show me around" link), whatever was seen before
    const asked = new URLSearchParams(window.location.search).has("tour");
    if (!asked && !(enabled && !seen())) return;
    // just after mount, so the page has laid out before the first stop is measured
    // (a timeout rather than a frame: frames pause in background tabs)
    const timer = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(timer);
  }, [enabled]);

  const stops = React.useMemo(() => (open ? STOPS.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)) : []), [open]);
  const stop = stops[i];

  const close = React.useCallback(() => {
    writeLocal(TOUR_KEY, new Date().toISOString());
    setOpen(false);
  }, []);

  // ring the current stop, and keep the ring on it as the page scrolls or resizes
  React.useLayoutEffect(() => {
    if (!open || !stop) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
    const place = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, stop]);

  React.useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, close]);

  if (!open || !stop || !rect) return null;
  const last = i === stops.length - 1;
  // the card sits below the ring when there is room, otherwise above it
  const below = rect.top + rect.height + 220 < window.innerHeight;
  const cardTop = below ? rect.top + rect.height + 12 : Math.max(12, rect.top - 12 - 200);
  const cardLeft = Math.min(Math.max(12, rect.left), window.innerWidth - 12 - Math.min(360, window.innerWidth - 24));

  return createPortal(
    <div className="pip-tour" role="dialog" aria-modal="true" aria-label={t("label")}>
      <div className="pip-tour-ring" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      <div ref={cardRef} tabIndex={-1} className="pip-tour-card" style={{ top: cardTop, left: cardLeft }} aria-labelledby="pip-tour-title" aria-describedby="pip-tour-body">
        <div className="flex items-start gap-3">
          <AssistantAvatar className="size-10" reaction="point" />
          <div className="min-w-0">
            <div className="text-xs text-ink-faint">{t("stepOf", { n: i + 1, total: stops.length })}</div>
            <h2 id="pip-tour-title" className="font-semibold">{t(stop.title)}</h2>
            <p id="pip-tour-body" className="mt-1 text-sm text-ink-muted">{t(stop.body)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-ink-muted" onClick={close}>
            {t("skip")}
          </Button>
          <div className="ml-auto flex gap-2">
            {i > 0 ? (
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setI(i - 1)}>
                {t("back")}
              </Button>
            ) : null}
            <Button variant="brand" size="sm" onClick={() => (last ? close() : setI(i + 1))}>
              {last ? t("finish") : t("next")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
