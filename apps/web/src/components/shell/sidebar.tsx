"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Check } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/kit/logo";
import { NAV, ROLES, type Role } from "@/lib/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserBadge, type ShellUser } from "@/components/shell/user-badge";

export type SidebarProps = {
  role: Role;
  /** roles this user actually holds; others are listed as unavailable */
  heldRoles: Role[];
  user: ShellUser;
  badges?: Partial<Record<string, number>>;
  onNavigate?: () => void;
  className?: string;
};

/** True when `href` is the active section for `pathname` (longest-prefix wins). */
export function useIsActive(role: Role) {
  const pathname = usePathname() ?? "";
  const hrefs = NAV[role].flatMap((s) => s.items.map((i) => i.href));
  const best = hrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return (href: string) => href === best;
}

/**
 * App sidebar (reference images 2 and 3): logo, role switcher, icon + label
 * nav with an active pill, user card at the bottom. Rendered in a fixed column
 * at >= 900px and inside a Sheet below that.
 */
export function Sidebar({ role, heldRoles, user, badges = {}, onNavigate, className }: SidebarProps) {
  const t = useTranslations("nav");
  // the desktop column and the mobile sheet each get their own pill
  const layoutScope = onNavigate ? "sheet" : "rail";
  const isActive = useIsActive(role);

  return (
    <div className={cn("flex h-full flex-col gap-5 px-3 py-5", className)}>
      <Link
        href="/"
        className="mx-2 w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={onNavigate}
      >
        <Logo />
      </Link>

      <RoleSwitcher role={role} heldRoles={heldRoles} />

      <nav aria-label={t("dashboard")} className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV[role].map((section, si) => (
          <ul key={si} className={cn("isolate flex flex-col gap-0.5", si > 0 && "border-t border-line pt-4")}>
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const badge = badges[item.key];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-(--dur-1) outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring/60",
                      active ? "text-brand-ink" : "text-ink-muted hover:bg-panel-2 hover:text-ink",
                    )}
                  >
                    {active ? (
                      // shared-layout pill: glides between items on navigation
                      <motion.span
                        layoutId={`nav-pill-${layoutScope}`}
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-lg border border-brand-line bg-brand-soft shadow-[0_8px_24px_-14px_var(--accent)]"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <Icon
                      aria-hidden
                      className={cn(
                        "size-[18px] shrink-0",
                        active ? "text-brand-ink" : "text-ink-faint group-hover:text-ink-muted",
                      )}
                    />
                    <span className="flex-1 truncate">{t(item.key as Parameters<typeof t>[0])}</span>
                    {badge ? (
                      <span className="min-w-5 rounded-pill bg-coral px-1.5 text-center text-xs leading-5 font-semibold text-plum tabular-nums">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </nav>

      <UserBadge user={user} className="mx-1" />
    </div>
  );
}

function RoleSwitcher({ role, heldRoles }: { role: Role; heldRoles: Role[] }) {
  const t = useTranslations("roles");
  const tn = useTranslations("nav");
  const ts = useTranslations("shell");
  const multi = heldRoles.length > 1;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-left text-sm shadow-sm outline-none hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={tn("switchRole")}
        >
          <span className="flex-1">
            <span className="block text-xs text-ink-faint">{tn("switchRole")}</span>
            <span className="block font-medium">{t(role)}</span>
          </span>
          <ChevronsUpDown className="size-4 text-ink-faint" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-ink-faint">
          {multi ? ts("rolesHeld") : ts("rolesSingle")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLES.map((r) => {
          const held = heldRoles.includes(r);
          return (
            <DropdownMenuItem key={r} disabled={!held} className="justify-between">
              {t(r)}
              {r === role ? <Check className="size-4 text-brand-ink" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
