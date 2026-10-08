"use client";

import * as React from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Horizontal carousel (Coursera's module strip): scroll-snap track that can be
 * dragged with a mouse, swiped on touch, scrolled with a trackpad, and moved
 * with the arrow buttons. Follows the WAI carousel pattern: a labelled region,
 * slides as labelled groups, and buttons that announce their action.
 */
export function Carousel({
  label,
  prevLabel,
  nextLabel,
  children,
  className,
  controls = "bottom",
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  children: React.ReactNode;
  className?: string;
  controls?: "bottom" | "top" | "none";
}) {
  const track = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });
  const drag = React.useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = React.useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  React.useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  function page(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>("[data-slot=carousel-slide]");
    const step = slide ? slide.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  // mouse drag-to-scroll; touch and trackpads scroll natively
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: track.current!.scrollLeft, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4 && !d.moved) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = "";
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const el = track.current;
    if (el && drag.current?.moved) {
      el.releasePointerCapture(e.pointerId);
      delete el.dataset.dragging;
      // swallow the click that ends a drag
      const stop = (ev: Event) => ev.stopPropagation();
      el.addEventListener("click", stop, { capture: true, once: true });
    }
    drag.current = null;
  }

  const buttons = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={() => page(-1)} disabled={edges.start} aria-label={prevLabel}>
        <ChevronLeft />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => page(1)} disabled={edges.end} aria-label={nextLabel}>
        <ChevronRight />
      </Button>
    </div>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      data-slot="carousel"
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      {controls === "top" ? <div className="flex justify-end">{buttons}</div> : null}
      <div
        ref={track}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "cursor-grab data-[dragging]:cursor-grabbing data-[dragging]:snap-none data-[dragging]:scroll-auto data-[dragging]:select-none",
          "[mask-image:linear-gradient(90deg,#000_90%,transparent)]",
        )}
      >
        {children}
      </div>
      {controls === "bottom" ? <div className="flex justify-end">{buttons}</div> : null}
    </section>
  );
}

export function CarouselSlide({
  label,
  className,
  children,
}: {
  /** e.g. "Module 2 of 5" */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      data-slot="carousel-slide"
      className={cn("shrink-0 snap-start", className)}
    >
      {children}
    </div>
  );
}
