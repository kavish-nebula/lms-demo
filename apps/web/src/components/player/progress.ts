"use client";

import * as React from "react";
import { useLocalJson, useLocalString, writeLocal } from "@/lib/local-store";
import type { StageId } from "@/lib/stages";

/**
 * Per-module stage completion for the UI phase. Keys are stable step IDs
 * (agents.md hard rule 1), stored locally until POST /v1/enrollments/{id}/events
 * exists. Before anything is stored, the course outline's state is used.
 */
const key = (moduleId: string) => `lms-progress:${moduleId}`;

export function useModuleProgress(moduleId: string, initialDone: StageId[]) {
  const done = useLocalJson<StageId[]>(key(moduleId), initialDone);

  const complete = React.useCallback(
    (stage: StageId) => {
      if (done.includes(stage)) return;
      writeLocal(key(moduleId), JSON.stringify([...done, stage]));
    },
    [done, moduleId],
  );

  const reset = React.useCallback(() => writeLocal(key(moduleId), null), [moduleId]);

  return { done, complete, reset };
}

/** Draft text for reflection answers; a per-viewer convenience only. */
export function useDraft(id: string, initial = "") {
  const k = `lms-draft:${id}`;
  const stored = useLocalString(k);
  const update = React.useCallback((v: string) => writeLocal(k, v), [k]);
  return [stored ?? initial, update] as const;
}
