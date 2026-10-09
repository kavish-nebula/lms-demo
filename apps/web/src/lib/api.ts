"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { useHydrated } from "@/lib/local-store";
import type { EnrollmentView } from "@/lib/learner-plan";
import type { SetupAnswers } from "@/lib/setup";

/**
 * The client side of /api/v1. One SWR cache entry holds every enrollment
 * (setup, current plan, progress); hooks in lib/enrollment.ts, lib/profile.ts
 * and the player read from it. While a plan is being written the cache
 * polls, so the new plan appears without a reload.
 */

export class ApiRequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(url: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    keepalive: init.keepalive,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
  if (!res.ok) throw new ApiRequestError(res.status, data.error?.code ?? "http_error", data.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export const ENROLLMENTS = "/api/v1/enrollments";
export const PROFILE = "/api/v1/profile";
export const plansKey = (courseId: string) => `/api/v1/enrollments/${courseId}/plans`;

type EnrollmentsResponse = { enrollments: EnrollmentView[] };
export type ProfileView = { answers: SetupAnswers; needs: string[]; at: string } | null;

const fetcher = <T,>(url: string) => api<T>(url);

/** Every enrollment, by course id. `ready` turns true once the server has answered (or failed). */
export function useLearnerData() {
  const { data, error } = useSWR<EnrollmentsResponse>(ENROLLMENTS, fetcher, {
    // poll while a plan is being written
    refreshInterval: (latest) => (latest?.enrollments.some((e) => e.pending) ? 2500 : 0),
    revalidateOnFocus: true,
  });
  useImportOnce(data);
  const enrollments = React.useMemo(() => {
    const out: Record<string, EnrollmentView> = {};
    for (const e of data?.enrollments ?? []) out[e.courseId] = e;
    return out;
  }, [data]);
  return { enrollments, ready: !!data || !!error, error: error as Error | undefined };
}

/** True once the page can show learner-specific views without flashing the wrong one. */
export function useLearnerReady() {
  const hydrated = useHydrated();
  const { ready } = useLearnerData();
  return hydrated && ready;
}

/** Put a fresh enrollment from the server into the cache. */
export function storeEnrollment(e: EnrollmentView) {
  return mutate<EnrollmentsResponse>(
    ENROLLMENTS,
    (cur) => ({ enrollments: [...(cur?.enrollments ?? []).filter((x) => x.courseId !== e.courseId), e] }),
    { revalidate: false },
  );
}

export const refreshEnrollments = () => mutate(ENROLLMENTS);

export function useProfileData() {
  const { data, error } = useSWR<{ profile: ProfileView }>(PROFILE, fetcher);
  return { profile: data?.profile ?? null, ready: !!data || !!error };
}

export const storeProfile = (profile: ProfileView) => mutate(PROFILE, { profile }, { revalidate: false });

/* ---------------------------------------------------------------- one-time import */

let importStarted = false;

/**
 * Before the backend, the profile, enrollments and topics done lived in
 * localStorage. The first time the server has nothing for this learner and
 * the browser does, send it up once, then drop the local copies.
 */
function useImportOnce(data: EnrollmentsResponse | undefined) {
  React.useEffect(() => {
    if (!data || importStarted || data.enrollments.length) return;
    let profile: unknown = null;
    const enrollments: unknown[] = [];
    const progress: Record<string, string[]> = {};
    const keys: string[] = [];
    const progressKeys: string[] = [];
    try {
      for (const k of Object.keys(localStorage)) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        if (k === "lms-profile") {
          const p = JSON.parse(v) as { answers: SetupAnswers; needs: string[] };
          profile = { answers: p.answers, needs: (p.needs ?? []).filter((n) => ["text", "motion", "none"].includes(n)) };
          keys.push(k);
        } else if (k.startsWith("lms-enrollment:")) {
          const e = JSON.parse(v) as { courseId: string; answers: SetupAnswers; supportOverride?: string; precheck?: unknown; enrolledAt?: string };
          enrollments.push({ courseId: e.courseId, answers: e.answers, supportOverride: e.supportOverride ?? "auto", precheck: e.precheck ?? null, enrolledAt: e.enrolledAt });
          keys.push(k);
        } else if (k.startsWith("lms-progress:")) {
          progress[k.slice("lms-progress:".length)] = JSON.parse(v) as string[];
          progressKeys.push(k);
        }
      }
    } catch {
      return;
    }
    if (!profile && !enrollments.length) return;
    importStarted = true;
    api<{ imported: number }>("/api/v1/me/import", { method: "POST", body: { profile, enrollments, progress } })
      .then(() => {
        // topics done only move with an enrollment; a preview's progress stays local
        for (const k of enrollments.length ? [...keys, ...progressKeys] : keys) localStorage.removeItem(k);
        void mutate(ENROLLMENTS);
        void mutate(PROFILE);
      })
      .catch(() => {
        importStarted = false;
      });
  }, [data]);
}
