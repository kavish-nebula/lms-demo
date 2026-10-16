/**
 * The app's accent colour follows the learner's field (packages/ui/tokens.css,
 * [data-accent]). Kept in `lms-prefs` so the inline script can set it before
 * paint; students and typed fields keep the brand indigo.
 */
import { writeLocal } from "@/lib/local-store";
import { PREFS_KEY } from "@/lib/prefs";
import type { SetupAnswers } from "@/lib/setup";

export const FIELD_ACCENTS = ["it", "manufacturing", "retail", "finance", "healthcare", "education"] as const;
export type FieldAccent = (typeof FIELD_ACCENTS)[number];

export function accentFor(a: SetupAnswers | null | undefined): FieldAccent | null {
  const d = a?.domain;
  return d && (FIELD_ACCENTS as readonly string[]).includes(d) ? (d as FieldAccent) : null;
}

/** Sets the accent on <html> now and remembers it for the next page load. */
export function applyFieldAccent(accent: FieldAccent | null) {
  try {
    const r = document.documentElement;
    if (accent) r.setAttribute("data-accent", accent);
    else r.removeAttribute("data-accent");
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, unknown>;
    if ((prefs.accent ?? null) !== accent) writeLocal(PREFS_KEY, JSON.stringify({ ...prefs, accent }));
  } catch {
    // storage blocked: the colour still applies for this page
  }
}
