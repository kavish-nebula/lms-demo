/**
 * The learner's field as one of the groups Pip has a line for (the quote on
 * the mission card and in the welcome chat, `enroll.pipQuote_*`). A typed
 * field is "other"; no field, no group.
 */
import type { SetupAnswers } from "@/lib/setup";

export const FIELD_GROUPS = ["it", "manufacturing", "retail", "finance", "healthcare", "education", "student", "other"] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export function fieldGroupOf(a: SetupAnswers | null | undefined): FieldGroup | null {
  const d = a?.domain;
  if (!d) return null;
  return (FIELD_GROUPS as readonly string[]).includes(d) ? (d as FieldGroup) : "other";
}
