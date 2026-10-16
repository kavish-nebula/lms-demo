"use client";

import * as React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { ConceptVideo, ExplainerBlock, HookBlock, ModuleContent, WorkedBlock } from "@/data/types";

/** A module's pieces rewritten for this learner (GET /api/v1/enrollments/:course/modules/:module/adapted). */
export type AdaptedModule = {
  pieces: Record<string, { status: "writing" | "voicing" | "ready" | "failed" }>;
  hook: HookBlock | null;
  videos: Record<string, ConceptVideo>;
  worked: WorkedBlock | null;
  world: { organisation: string } | null;
};

const fetcher = (url: string) => api<{ adapted: AdaptedModule }>(url).then((r) => r.adapted);
const busy = (a?: AdaptedModule) => !!a && Object.values(a.pieces).some((p) => p.status === "writing" || p.status === "voicing");
const failed = (a?: AdaptedModule) => !!a && Object.values(a.pieces).some((p) => p.status === "failed");

/**
 * The pieces ready so far; checks back while some are still being written or
 * voiced, and now and then while one has failed (asking again is what makes
 * the server retry it). Only for enrolled learners.
 */
export function useAdaptedModule(courseId: string, moduleId: string, enabled: boolean) {
  const { data } = useSWR(enabled ? `/api/v1/enrollments/${courseId}/modules/${moduleId}/adapted` : null, fetcher, {
    refreshInterval: (latest) => (busy(latest) ? 8000 : failed(latest) ? 60_000 : 0),
    revalidateOnFocus: false,
  });
  return data;
}

/** The module with the learner's ready pieces in place of the authored ones. */
export function withAdapted(mod: ModuleContent, a: AdaptedModule | undefined): ModuleContent {
  if (!a || (!a.hook && !a.worked && !Object.keys(a.videos).length)) return mod;
  return {
    ...mod,
    blocks: mod.blocks.map((b) => {
      if (b.stage === "hook" && a.hook) return a.hook;
      if (b.stage === "worked" && a.worked) return a.worked;
      if (b.stage === "explainer" && b.videos) return { ...b, videos: b.videos.map((v) => a.videos[v.id] ?? v) } as ExplainerBlock;
      return b;
    }),
  };
}

/** Which piece a topic shows: "hook", "worked", or "video:<id>". */
export const pieceOf = (stage: string, videoId?: string) => (stage === "explainer" && videoId ? `video:${videoId}` : stage);

/**
 * The adapted pieces as they were when this topic opened: a piece that becomes
 * ready while the learner is in the middle of it waits until they next open
 * the topic, so a story never changes under them. The first answer still
 * applies, since it arrives before they start.
 */
export function useSteadyAdapted(latest: AdaptedModule | undefined, topicKey: string) {
  const [held, setHeld] = React.useState<{ key: string; data: AdaptedModule | undefined }>({ key: topicKey, data: latest });
  if (held.key !== topicKey || (held.data === undefined && latest !== undefined)) setHeld({ key: topicKey, data: latest });
  return held.data;
}
