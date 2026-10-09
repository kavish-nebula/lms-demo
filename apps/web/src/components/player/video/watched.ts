"use client";

import * as React from "react";
import { useLocalJson, writeLocal } from "@/lib/local-store";

const KEY = "lms-videos-watched";
const NONE: string[] = [];

/** Lesson videos the learner has watched (or moved on from), by video id. Kept in this browser. */
export function useWatchedVideos() {
  const watched = useLocalJson<string[]>(KEY, NONE);
  const markWatched = React.useCallback((id: string) => {
    const now = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    if (!now.includes(id)) writeLocal(KEY, JSON.stringify([...now, id]));
  }, []);
  return { watched, markWatched };
}
