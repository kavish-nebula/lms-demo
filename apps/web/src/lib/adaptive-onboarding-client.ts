import { api } from "@/lib/api";
import type { SetupAnswers } from "@/lib/setup";
import type { AdaptiveSession } from "@/lib/adaptive-onboarding";

const pending = new Map<string, Promise<AdaptiveSession>>();
export function loadAdaptiveSession(courseId: string, answers: SetupAnswers) {
  const key = JSON.stringify([courseId, answers]);
  let job = pending.get(key);
  if (!job) {
    job = api<{ session: AdaptiveSession }>("/api/v1/onboarding", { method: "POST", body: { courseId, answers } }).then((r) => r.session);
    pending.set(key, job);
    void job.finally(() => pending.delete(key)).catch(() => undefined);
  }
  return job;
}
export const prefetchAdaptiveSession = (courseId: string, answers: SetupAnswers) => void loadAdaptiveSession(courseId, answers).catch(() => undefined);
export const adaptiveMediaUrl = (id: string, kind: "image" | "audio", index: number) => `/api/v1/onboarding/media?id=${encodeURIComponent(id)}&kind=${kind}&index=${index}`;
