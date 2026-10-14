"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { House, GraduationCap, CalendarDays } from "lucide-react";
import { useEngagement } from "./provider";
export function MobileNavigation() {
  const p = useEngagement(); const path = usePathname(); const t = useTranslations("engagement");
  if (!p) return null;
  return <nav aria-label={t("home")} className="glass fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line pb-[env(safe-area-inset-bottom)] nav:hidden">{[{ href: "/learn",key: "home",Icon: House },{ href: "/learn/courses",key: "courses",Icon: GraduationCap },{ href: "/learn/plan",key: "plan",Icon: CalendarDays }].map(({ href,key,Icon }) => <Link key={href} href={href} aria-current={path===href ? "page" : undefined} className={`flex min-h-16 min-w-20 flex-col items-center justify-center gap-1 rounded-lg px-3 text-xs focus-visible:outline-2 focus-visible:outline-brand ${path===href ? "text-brand-ink" : "text-ink-muted"}`}><Icon className="size-5" aria-hidden />{t(key as "home")}</Link>)}</nav>;
}
