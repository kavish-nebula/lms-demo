"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GraduationCap, Search } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { NAV, type Role } from "@/lib/nav";
import { cn } from "cn";

export type CommandCourse = { id: string; title: string; href: string };

/** Search trigger styled like an input (reference image 3) plus a Ctrl/Cmd+K palette. */
export function CommandMenu({
  role,
  courses,
  className,
}: {
  role: Role;
  courses: CommandCourse[];
  className?: string;
}) {
  const t = useTranslations("common");
  const tn = useTranslations("nav");
  const ts = useTranslations("shell");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-panel/80 px-3 text-sm text-ink-faint shadow-sm outline-none sm:max-w-sm",
          "hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring/60",
          className,
        )}
        aria-label={t("search")}
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate text-left">{t("searchPlaceholder")}</span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={t("searchPlaceholder")}>
        {/* CommandDialog is only the dialog frame; cmdk's store lives in <Command>. */}
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{ts("noResults")}</CommandEmpty>
            <CommandGroup heading={ts("groupNavigate")}>
              {NAV[role].flatMap((s) =>
                s.items.map((item) => {
                  const Icon = item.icon;
                  const label = tn(item.key as Parameters<typeof tn>[0]);
                  return (
                    <CommandItem key={item.href} value={label} onSelect={() => go(item.href)}>
                      <Icon aria-hidden />
                      {label}
                    </CommandItem>
                  );
                }),
              )}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={ts("groupCourses")}>
              {courses.map((c) => (
                <CommandItem key={c.id} value={c.title} onSelect={() => go(c.href)}>
                  <GraduationCap aria-hidden />
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
