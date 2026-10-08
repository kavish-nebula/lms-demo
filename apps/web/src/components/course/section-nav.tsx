"use client";

import * as React from "react";
import { cn } from "cn";
import { motion } from "motion/react";
import { EnrollCta } from "@/components/course/enroll-cta";
import type { Course } from "@/data/types";

export type SectionLink = { id: string; label: string };

/**
 * Sticky in-page navigation (Coursera's About / Outcomes / Courses / Reviews
 * bar). Links jump to their section; the one in view is marked with
 * aria-current and a sliding underline. Once the hero scrolls away, the bar
 * also shows the course title and its primary action.
 */
export function SectionNav({
  sections,
  course,
  heroId,
  label,
}: {
  sections: SectionLink[];
  course: Course;
  heroId: string;
  label: string;
}) {
  const [active, setActive] = React.useState(sections[0]?.id);
  const [compact, setCompact] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLElement>(null);

  // keep the active link visible when the bar scrolls sideways (phones)
  React.useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>("a[aria-current]");
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    nav.scrollTo({ left: nav.scrollLeft + (l.left - n.left) - (n.width - l.width) / 2, behavior: "smooth" });
  }, [active]);

  // A click pins the chosen link until its smooth scroll settles, so the spy
  // does not flicker through the sections in between.
  const pinned = React.useRef<{ id: string; until: number } | null>(null);

  React.useEffect(() => {
    let frame = 0;
    const spy = () => {
      frame = 0;
      const pin = pinned.current;
      if (pin && performance.now() < pin.until) return setActive(pin.id);
      pinned.current = null;
      const line = (barRef.current?.getBoundingClientRect().bottom ?? 120) + 24;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(atBottom ? sections[sections.length - 1]?.id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(spy);
    };
    spy();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const hero = document.getElementById(heroId);
    const heroIo = hero ? new IntersectionObserver(([e]) => setCompact(!e!.isIntersecting), { rootMargin: "-64px 0px 0px 0px" }) : null;
    if (hero) heroIo!.observe(hero);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      heroIo?.disconnect();
    };
  }, [sections, heroId]);


  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    setActive(id);
    pinned.current = { id, until: e.timeStamp + 900 }; // same clock as performance.now()
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    // move focus for keyboard and screen reader users without a second scroll
    el.focus({ preventScroll: true });
  }

  return (
    <div
      ref={barRef}
      className="glass glass-sm sticky top-(--nav-h) z-20 -mx-(--page-pad) border-x-0 border-t-0 px-(--page-pad) shadow-none"
    >
      <div className="flex min-h-14 items-center gap-4">
        <motion.div
          initial={false}
          animate={{ opacity: compact ? 1 : 0, width: compact ? "auto" : 0 }}
          transition={{ duration: 0.25 }}
          className="hidden min-w-0 overflow-hidden xl:block"
          aria-hidden={!compact}
        >
          <span className="block max-w-72 truncate font-semibold whitespace-nowrap">{course.title}</span>
        </motion.div>
        <nav ref={navRef} aria-label={label} className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {sections.map((s) => {
            const on = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "relative shrink-0 rounded-md px-3 py-4 text-sm font-medium whitespace-nowrap outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/60",
                  on ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {s.label}
                {on ? (
                  <motion.span
                    layoutId="section-underline"
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-pill bg-brand"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
              </a>
            );
          })}
        </nav>
        <motion.div
          initial={false}
          animate={{ opacity: compact ? 1 : 0, y: compact ? 0 : -6 }}
          transition={{ duration: 0.25 }}
          className={cn("hidden shrink-0 sm:block", !compact && "pointer-events-none")}
          aria-hidden={!compact}
          inert={!compact}
        >
          <EnrollCta course={course} size="sm" showEdit={false} />
        </motion.div>
      </div>
    </div>
  );
}
