"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/kit/logo";
import { Button } from "@/components/ui/button";

/** Marketing nav (reference image 1): glass bar that firms up after scrolling. */
export function SiteNav() {
  const t = useTranslations("marketing");
  const tc = useTranslations("common");
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#method", label: t("navMethod") },
    { href: "#teams", label: t("navTeams") },
    { href: "#pricing", label: t("navPricing") },
    { href: "#faq", label: t("navFaq") },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-2xl border px-4 transition-[background-color,border-color,box-shadow] duration-(--dur-2)",
          scrolled || open ? "glass glass-edge" : "border-transparent",
        )}
      >
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <Logo />
        </Link>
        <nav aria-label={t("navLabel")} className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Button asChild variant="outline" className="border-brand-line bg-transparent">
            <Link href="/auth/sign-in">{tc("signIn")}</Link>
          </Button>
          <Button asChild variant="brand">
            <Link href="/auth/sign-in">{tc("getStarted")}</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? tc("close") : t("openMenu")}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label={t("navLabel")} className="glass glass-edge mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl p-3 lg:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-ink-muted hover:bg-white/5 hover:text-ink">
              {l.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/auth/sign-in">{tc("signIn")}</Link>
            </Button>
            <Button asChild variant="brand">
              <Link href="/auth/sign-in">{tc("getStarted")}</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
