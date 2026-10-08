"use client";

import * as React from "react";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import { PREFS_KEY } from "@/lib/prefs";
import type { SetupAnswers } from "@/lib/setup";

/**
 * The learner profile: answered once, at the first enrolment, and reused for
 * every course after that. Editable on the Profile page. Kept locally until
 * PUT /v1/me/profile exists.
 */
export type Profile = { answers: SetupAnswers; needs: string[]; at: string; version: 1 };

const KEY = "lms-profile";

/** Comfort answers become the app's display settings (text size, motion). */
export function applyComfort(needs: string[]) {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, unknown>;
    const next = { ...prefs, textScale: needs.includes("text") ? "large" : "normal", reduceMotion: needs.includes("motion") };
    writeLocal(PREFS_KEY, JSON.stringify(next));
    const root = document.documentElement;
    root.classList.toggle("text-lg", next.textScale === "large");
    root.classList.toggle("reduce-motion", next.reduceMotion);
  } catch {
    // storage blocked: the answers still shape the course
  }
}

export function useProfile() {
  const profile = useLocalJson<Profile | null>(KEY, null);

  const save = React.useCallback((answers: SetupAnswers, needs: string[]) => {
    const next: Profile = { answers, needs, at: new Date().toISOString(), version: 1 };
    writeLocal(KEY, JSON.stringify(next));
    if (needs.length) applyComfort(needs.includes("none") ? [] : needs);
  }, []);

  return { profile, save };
}
