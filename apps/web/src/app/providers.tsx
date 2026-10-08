"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { applyPrefs } from "@/lib/prefs";

type ProvidersProps = {
  locale: string;
  messages: AbstractIntlMessages;
  /** the app honours the learner's light-theme choice; marketing stays dark */
  themeable?: boolean;
  children: React.ReactNode;
};

type RootState = { reduce: boolean; dark: boolean };

/** Watches <html> for the learner's reduced-motion class and the theme attribute. */
function useRootState(): RootState {
  const [state, setState] = React.useState<RootState>({ reduce: false, dark: true });
  React.useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setState({ reduce: root.classList.contains("reduce-motion"), dark: root.dataset.theme === "aurora" });
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return state;
}

/**
 * One passive pointer listener drives the cursor spotlight on every
 * [data-spotlight] card, so cards can stay server components.
 */
function useSpotlight() {
  React.useEffect(() => {
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.("[data-spotlight]") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * Client-side providers shared by both root layouts. MotionConfig follows the
 * OS reduced-motion setting unless the learner turned motion off in Settings.
 */
export function Providers({ locale, messages, themeable = false, children }: ProvidersProps) {
  // Re-apply saved preferences after hydration; React's dev remount resets <html>.
  React.useLayoutEffect(() => applyPrefs(themeable), [themeable]);
  const { reduce, dark } = useRootState();
  useSpotlight();

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <MotionConfig reducedMotion={reduce ? "always" : "user"}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" theme={dark ? "dark" : "light"} />
      </MotionConfig>
    </NextIntlClientProvider>
  );
}
