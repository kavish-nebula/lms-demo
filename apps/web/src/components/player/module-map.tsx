"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check, PlayCircle } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { STAGE_META } from "@/lib/stages";
import type { ModulePart, ModuleSection } from "@/lib/module-outline";

/**
 * A module laid out under side headings (The problem, Learn the ideas, See it
 * work, Build it, Apply it, Check yourself, Make it stick), each part numbered,
 * with what the learner does in it and how long it takes. Every part is a
 * link: nothing is locked. "rail" is the player's sidebar; "page" is the
 * roomier list on the course page.
 */
export function ModuleMap({
  sections,
  moduleHref,
  doneKeys,
  currentKey,
  nextKey,
  variant = "rail",
  label,
  onNavigate,
}: {
  sections: ModuleSection[];
  /** /learn/courses/{course}/{module} */
  moduleHref: string;
  doneKeys: ReadonlySet<string>;
  currentKey?: string;
  /** the part to suggest next ("Up next") */
  nextKey?: string;
  variant?: "rail" | "page";
  label: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("outline");
  const tc = useTranslations("common");
  const page = variant === "page";
  const ref = React.useRef<HTMLElement>(null);

  // keep the part on screen visible in a scrolling sidebar, without moving the page itself
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="step"]');
    const box = ref.current?.closest<HTMLElement>("[data-map-scroll]");
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 3;
  }, [currentKey]);

  return (
    <nav ref={ref} aria-label={label} className={cn("flex flex-col", page ? "gap-5" : "gap-4")}>
      {sections.map((section, si) => {
        const done = section.parts.filter((p) => doneKeys.has(p.key)).length;
        return (
          <section key={`${section.id}-${si}`} aria-labelledby={`map-${section.id}-${si}`} className="flex flex-col gap-1">
            <div className={cn("flex items-baseline justify-between gap-2", page ? "px-0 pb-1" : "px-2.5")}>
              <h3 id={`map-${section.id}-${si}`} className={cn("font-semibold tracking-wide text-ink-faint uppercase", page ? "text-xs" : "text-[0.7rem]")}>
                <span className="mr-1.5 tabular-nums">{si + 1}</span>
                {t(`section_${section.id}`)}
              </h3>
              <span className="shrink-0 text-xs text-ink-faint tabular-nums">
                {section.parts.length > 1 ? `${done}/${section.parts.length} · ` : ""}
                {tc("minutes", { count: section.minutes })}
              </span>
            </div>
            <ol className={cn("flex flex-col", page ? "gap-2" : "gap-0.5")}>
              {section.parts.map((part) => (
                <li key={part.key}>
                  <PartLink
                    part={part}
                    href={`${moduleHref}/${part.path}`}
                    done={doneKeys.has(part.key)}
                    current={part.key === currentKey}
                    next={part.key === nextKey}
                    page={page}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </nav>
  );
}

function PartLink({
  part,
  href,
  done,
  current,
  next,
  page,
  onNavigate,
}: {
  part: ModulePart;
  href: string;
  done: boolean;
  current: boolean;
  next: boolean;
  page: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("outline");
  const tc = useTranslations("common");
  const meta = STAGE_META[part.stage];
  const Icon = part.video ? PlayCircle : meta.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "step" : undefined}
      className={cn(
        "flex w-full items-start gap-3 text-left text-sm outline-none transition-colors duration-(--dur-1) focus-visible:ring-2 focus-visible:ring-ring/60",
        page ? "rounded-lg border p-3 hover:border-brand-line" : "rounded-lg px-2.5 py-2",
        page && (next ? "border-brand-line bg-brand-soft/40" : "border-line"),
        !page && (current ? "bg-brand-soft font-medium text-brand-ink" : done ? "text-ink hover:bg-panel-2" : "text-ink-muted hover:bg-panel-2"),
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border [&_svg]:size-4",
          page ? "size-8" : "size-7",
          done ? "border-transparent bg-ok text-on-ok" : meta.chip,
        )}
      >
        {done ? <Check aria-hidden /> : <Icon aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faint tabular-nums">{part.n}</span>
          <span className={cn("min-w-0 flex-1 leading-snug", page && "font-medium text-ink")}>{part.title}</span>
          {next && page ? (
            <Chip size="sm" tone="accent" className="shrink-0">
              {t("upNext")}
            </Chip>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-snug font-normal text-ink-faint">{t(`does_${part.deliverable.key}`, part.deliverable.values)}</span>
      </span>
      {part.minutes != null ? <span className="pt-0.5 text-xs text-ink-faint tabular-nums">{page ? tc("minutes", { count: part.minutes }) : `${part.minutes}m`}</span> : null}
    </Link>
  );
}
