import { api } from "@/lib/api";
import type { MissionScript } from "@/lib/mission";
import type { SetupAnswers } from "@/lib/setup";

/**
 * The Mission story takes the model 10 to 20 seconds to write, so it is
 * requested as soon as the profile is known (end of "About you") and kept
 * here; the Mission step then picks up the same request instead of starting
 * its own. One story per course and profile; a failed request is forgotten so
 * "Try again" asks afresh.
 */
const pending = new Map<string, Promise<MissionScript>>();

const PROFILE_KEYS = ["domain", "domainOther", "role", "roleOther", "subRole", "useCase", "experience", "goal", "goalDetail"] as const;
const keyOf = (courseId: string, a: SetupAnswers) => `${courseId}|${PROFILE_KEYS.map((k) => a[k] ?? "").join("|")}`;

export function loadMission(courseId: string, answers: SetupAnswers): Promise<MissionScript> {
  const key = keyOf(courseId, answers);
  let p = pending.get(key);
  if (!p) {
    p = api<{ mission: MissionScript }>("/api/v1/mission", { method: "POST", body: { courseId, answers } }).then((r) => r.mission);
    pending.set(key, p);
    p.catch(() => pending.delete(key));
  }
  return p;
}

/** Starts writing the story in the background; errors surface later, in the Mission step. */
export const prefetchMission = (courseId: string, answers: SetupAnswers) => void loadMission(courseId, answers).catch(() => undefined);
