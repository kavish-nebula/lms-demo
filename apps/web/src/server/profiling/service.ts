import "server-only";
import { normalizeAnswers, profilePart, questionsFor, type SetupAnswers } from "@/lib/setup";
import { fieldKey, type ProfileDerived } from "@/lib/profiling/derived";
import * as repo from "@/server/repo";
import type { LlmTransport } from "@/server/ai/llm";
import { PROMPT_VERSION, analyseTypedField } from "./analyse";

/**
 * "About you" on the server. Each answer is saved to a draft, so the chat
 * resumes anywhere; a newly typed field is analysed (analyse.ts) and the
 * result kept with the draft; finishing turns the draft into the profile.
 * The question engine itself (lib/setup.ts) is shared with the browser, which
 * runs it too, so the next question appears without waiting for the network.
 */

export type ProfilingView = {
  answers: SetupAnswers;
  needs: string[];
  derived: ProfileDerived | null;
  /** the questions as they stand, in order (the browser computes the same list) */
  questions: { id: string; label: string; q: string; options: { v: string; label: string }[]; multi?: boolean; note?: string }[];
};

const view = (answers: SetupAnswers, needs: string[], derived: ProfileDerived | null): ProfilingView => ({
  answers,
  needs,
  derived,
  questions: questionsFor(answers, derived).map((q) => ({
    id: q.id,
    label: q.label,
    q: q.q,
    options: q.options.map((o) => ({ v: o.v, label: o.label })),
    ...(q.multi ? { multi: true } : {}),
    ...(q.note ? { note: q.note } : {}),
  })),
});

/** Where "About you" stands: the draft if one is in progress, else the saved profile, else nothing yet. */
export async function profilingState(userId: string): Promise<ProfilingView | null> {
  const draft = await repo.getProfileDraft(userId);
  if (draft) return view(draft.answers, draft.needs, draft.derived ?? null);
  const profile = await repo.getProfile(userId);
  return profile ? view(profile.answers, profile.needs, profile.derived ?? null) : null;
}

/** Saves the answers so far; analyses a typed field the first time it appears (or when it changes). */
export async function profilingStep(userId: string, input: { answers: SetupAnswers; needs: string[] }, transport?: LlmTransport | null): Promise<ProfilingView> {
  const [draft, profile] = await Promise.all([repo.getProfileDraft(userId), repo.getProfile(userId)]);
  const derived = await derivedFor(userId, input.answers, draft?.derived ?? profile?.derived ?? null, transport);
  const answers = normalizeAnswers(input.answers, derived);
  await repo.saveProfileDraft(userId, answers, input.needs, derived);
  return view(answers, input.needs, derived);
}

const RETRY_FAILED_MS = 60_000;

/** "Start over": the draft is discarded; a saved profile is kept. */
export async function discardDraft(userId: string) {
  await repo.deleteProfileDraft(userId);
}

/** The derived result for these answers: the stored one, or a fresh analysis when the typed field is new or changed. */
async function derivedFor(userId: string, answers: SetupAnswers, stored: ProfileDerived | null, transport?: LlmTransport | null): Promise<ProfileDerived | null> {
  const typed = answers.domain === "other" ? answers.domainOther?.trim() : undefined;
  if (!typed) return stored;
  // a new or changed field; one read by older instructions; or one whose analysis failed a minute or more ago (the model may be back)
  const stale =
    stored?.forField !== fieldKey(typed) ||
    (stored.prompt ?? 1) < PROMPT_VERSION ||
    (stored.failed && Date.now() - Date.parse(stored.at) >= RETRY_FAILED_MS);
  return stale ? analyseTypedField(userId, typed, transport) : stored;
}

/** Finishing "About you" (or changing it on the Profile page): the profile, with the derived result it was answered against. */
export async function finishProfile(userId: string, input: { answers: SetupAnswers; needs: string[] }, transport?: LlmTransport | null) {
  const [draft, profile] = await Promise.all([repo.getProfileDraft(userId), repo.getProfile(userId)]);
  const derived = await derivedFor(userId, input.answers, draft?.derived ?? profile?.derived ?? null, transport);
  // course answers (goal, what they know of a course…) belong to an enrolment, never the profile
  const saved = await repo.saveProfile(userId, normalizeAnswers(profilePart(input.answers), derived), input.needs, derived);
  await repo.deleteProfileDraft(userId);
  return saved!;
}
