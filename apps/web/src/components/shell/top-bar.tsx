"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, LogOut, Menu, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandMenu, type CommandCourse } from "@/components/shell/command-menu";
import { UserAvatar, type ShellUser } from "@/components/shell/user-badge";
import type { Role } from "@/lib/nav";

export type ShellNotification = { id: string; title: string; detail: string; href: string; unread?: boolean };

export type TopBarProps = {
  role: Role;
  user: ShellUser;
  courses: CommandCourse[];
  notifications: ShellNotification[];
  onOpenMenu: () => void;
  settingsHref: string;
};

/** Sticky glass top bar: menu (mobile), search, notifications, account. */
export function TopBar({ role, user, courses, notifications, onOpenMenu, settingsHref }: TopBarProps) {
  const t = useTranslations("common");
  const ts = useTranslations("shell");
  const tn = useTranslations("nav");
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
      <div className="flex h-(--nav-h) items-center gap-3 page-pad">
        <Button
          variant="ghost"
          size="icon"
          className="nav:hidden"
          onClick={onOpenMenu}
          aria-label={ts("openMenu")}
        >
          <Menu />
        </Button>

        <CommandMenu role={role} courses={courses} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={unread ? ts("notificationsUnread", { count: unread }) : t("notifications")}
              >
                <Bell />
                {unread ? (
                  <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-coral ring-2 ring-panel" />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold">{t("notifications")}</div>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="flex gap-3 px-4 py-3 text-sm hover:bg-panel-2">
                      <span
                        aria-hidden
                        className={n.unread ? "mt-1.5 size-2 shrink-0 rounded-full bg-brand-deep" : "mt-1.5 size-2 shrink-0"}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{n.title}</span>
                        <span className="block text-ink-muted">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label={ts("account")}
              >
                <UserAvatar user={user} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="truncate font-medium">{user.name}</div>
                <div className="truncate text-xs font-normal text-ink-faint">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/learn/profile">
                  <User aria-hidden />
                  {tn("profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={settingsHref}>
                  <Settings aria-hidden />
                  {tn("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">
                  <LogOut aria-hidden />
                  {t("signOut")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
