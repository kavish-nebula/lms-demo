import { cn } from "cn";

/** Code-native mascot: sharp at any scale, with no asset or network dependency. */
export function PipMascot({ className, happy = false }: { className?: string; happy?: boolean }) {
  return <svg viewBox="0 0 100 110" fill="none" className={cn("pip-mascot", className)} aria-hidden="true">
    <ellipse cx="50" cy="102" rx="27" ry="5" fill="var(--accent-soft)" />
    <path d="M34 84 29 98M66 84 71 98" stroke="var(--accent-ink)" strokeWidth="8" strokeLinecap="round" />
    <path d="M23 54 10 66M77 54 89 43" stroke="var(--accent-ink)" strokeWidth="8" strokeLinecap="round" />
    <path d="M50 20V10" stroke="var(--accent-ink)" strokeWidth="4" />
    <circle cx="50" cy="9" r="6" fill="var(--amber)" />
    <rect x="20" y="22" width="60" height="66" rx="25" fill="var(--accent-deep)" stroke="var(--accent-ink)" strokeWidth="2" />
    <rect x="27" y="33" width="46" height="32" rx="14" fill="var(--panel)" />
    {happy ? <path d="M35 48q5-8 10 0M55 48q5-8 10 0" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" /> : <><ellipse cx="40" cy="47" rx="4" ry="6" fill="var(--accent-ink)" /><ellipse cx="60" cy="47" rx="4" ry="6" fill="var(--accent-ink)" /></>}
    <path d="M44 56q6 5 12 0" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="m50 70 2.5 4 4.5 1-3 3 .5 4-4.5-2-4.5 2 .5-4-3-3 4.5-1Z" fill="var(--amber)" />
  </svg>;
}
