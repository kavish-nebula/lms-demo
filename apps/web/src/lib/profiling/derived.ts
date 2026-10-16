/**
 * What the language model worked out from a field the learner typed ("I run
 * a dental clinic"): the nearest field pack, so the usual role/tools/first-job
 * questions follow; that field's own nouns, for "In your world" examples; and,
 * when no pack fits, up to two follow-up questions. Written on the server
 * (server/profiling), validated before it is stored, and read by the question
 * engine in the browser and on the server alike. It applies only while the
 * typed field is the one it was made for.
 */
import type { Domain } from "@/lib/world";
import type { FieldId } from "@/lib/profiling/packs";

export type FollowUp = { id: string; q: string; options: { v: string; label: string }[] };

/** A role or first job the model wrote for a field with no pack; `as` maps a role onto the course's role texts. */
export type DerivedOption = { v: string; label: string; as?: "engineer" | "lead" | "manager" | "other" };

export type ProfileDerived = {
  version: 1;
  /** the typed field this was worked out for, trimmed and lower-cased */
  forField: string;
  /** the nearest field pack, when the model was confident enough */
  field: FieldId | null;
  /** they are studying, or not working yet: the student questions apply */
  student?: boolean;
  confidence: number;
  /** the field's own nouns for examples, or null to keep the general wording */
  vocab: Domain | null;
  followUps: FollowUp[];
  /** roles typical of the field (no pack): asked instead of the general list */
  roles?: DerivedOption[];
  /** repetitive jobs an agent could take on in the field (no pack): the first-job options */
  firstJobs?: DerivedOption[];
  /** "ai" from the model; "rules" from the keyword match (no key, or the model failed) */
  source: "ai" | "rules";
  /** set when the model could not be reached or replied with something unusable */
  failed?: boolean;
  /** which version of the instructions wrote it (server/profiling/analyse.ts); older results are redone */
  prompt?: number;
  model?: string;
  at: string;
};

export const fieldKey = (typed: string | null | undefined) => (typed ?? "").trim().toLowerCase().slice(0, 80);

/** The derived result, if it was made for the field these answers name. */
export function derivedFor(a: { domain?: string | null; domainOther?: string }, d: ProfileDerived | null | undefined): ProfileDerived | null {
  if (!d || a.domain !== "other") return null;
  const key = fieldKey(a.domainOther);
  return key && d.forField === key ? d : null;
}
