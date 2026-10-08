"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar, type ShellNotification } from "@/components/shell/top-bar";
import type { CommandCourse } from "@/components/shell/command-menu";
import type { ShellUser } from "@/components/shell/user-badge";
import type { Role } from "@/lib/nav";

export type AppShellProps = {
  role: Role;
  heldRoles: Role[];
  user: ShellUser;
  courses: CommandCourse[];
  notifications: ShellNotification[];
  badges?: Partial<Record<string, number>>;
  settingsHref: string;
  children: React.ReactNode;
};

/**
 * Signed-in app frame: fixed glass sidebar at >= 900px, a Sheet below that,
 * sticky top bar, and a padded content column with a skip link.
 */
export function AppShell({
  role,
  heldRoles,
  user,
  courses,
  notifications,
  badges,
  settingsHref,
  children,
}: AppShellProps) {
  const t = useTranslations("common");
  const ts = useTranslations("shell");
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-panel px-3 py-2 shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>

      <aside className="glass glass-sm sticky top-0 hidden h-dvh w-(--sidebar-w) shrink-0 border-y-0 border-l-0 shadow-none nav:block">
        <Sidebar role={role} heldRoles={heldRoles} user={user} badges={badges} />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-(--sidebar-w) p-0">
          <SheetTitle className="sr-only">{ts("menu")}</SheetTitle>
          <SheetDescription className="sr-only">{ts("menuDescription")}</SheetDescription>
          <Sidebar
            role={role}
            heldRoles={heldRoles}
            user={user}
            badges={badges}
            onNavigate={() => setMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          role={role}
          user={user}
          courses={courses}
          notifications={notifications}
          settingsHref={settingsHref}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main id="main" tabIndex={-1} className="flex-1 page-pad py-6 outline-none md:py-8">
          <div className="content-max">{children}</div>
        </main>
      </div>
    </div>
  );
}
