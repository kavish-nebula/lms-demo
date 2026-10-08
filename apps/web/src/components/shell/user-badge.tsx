import * as React from "react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type ShellUser = { name: string; email: string; avatar?: string | null };

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserAvatar({ user, className }: { user: ShellUser; className?: string }) {
  return (
    <Avatar className={cn("size-9", className)}>
      {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
      <AvatarFallback className="bg-brand-soft font-semibold text-brand-ink">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Avatar + name + email, used at the bottom of the sidebar. */
export function UserBadge({ user, className }: { user: ShellUser; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-line bg-panel p-2.5 shadow-sm", className)}>
      <UserAvatar user={user} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-ink-faint">{user.email}</div>
      </div>
    </div>
  );
}
