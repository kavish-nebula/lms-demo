"use client";

import * as React from "react";
import { api, storeProfile, useProfileData, type ProfileView } from "@/lib/api";
import { writeLocal } from "@/lib/local-store";
import { PREFS_KEY } from "@/lib/prefs";
import type { SetupAnswers } from "@/lib/setup";

/**
 * The learner profile: answered once, at the first enrolment, and reused for
 * every course after that. Editable on the Profile page. Stored on the server
 * (PUT /api/v1/profile); the comfort answers also set this browser's display.
 */
export type Profile = { answers: SetupAnswers; needs: string[]; at: string; version: 1 };

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
  const { profile: stored, ready } = useProfileData();
  const profile: Profile | null = React.useMemo(() => (stored ? { ...stored, version: 1 } : null), [stored]);

  const save = React.useCallback(async (answers: SetupAnswers, needs: string[]) => {
    // optimistic, then the server's copy
    await storeProfile({ answers, needs, at: new Date().toISOString() });
    const res = await api<{ profile: ProfileView }>("/api/v1/profile", { method: "PUT", body: { answers, needs } });
    await storeProfile(res.profile);
    if (needs.length) applyComfort(needs.includes("none") ? [] : needs);
  }, []);

  return { profile, ready, save };
}
