import * as React from "react";
import { cn } from "cn";
import { Inbox, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Centered empty state with an optional action. Every data component needs one. */
export function EmptyState({ icon, title, description, action, className }: StateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-panel-2 text-ink-faint [&_svg]:size-5">
        {icon ?? <Inbox />}
      </span>
      <div className="font-medium">{title}</div>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Inline error state. Keep the wording specific and offer a retry. */
export function ErrorState({ icon, title, description, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card border border-err-line bg-err-soft px-6 py-8 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-panel text-err [&_svg]:size-5">
        {icon ?? <TriangleAlert />}
      </span>
      <div className="font-medium text-err">{title}</div>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder for a card: title line plus a few body lines. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn("space-y-3 rounded-card border border-line bg-panel p-5", className)}
    >
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
