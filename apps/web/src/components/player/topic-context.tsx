"use client";

import * as React from "react";
import type { StageId } from "@/lib/stages";

/**
 * The topic on screen, provided by the module player and the finale player.
 * Stage components render through StageShell, which shows this title and
 * position instead of a method name.
 */
export type TopicHeader = { stage: StageId; title: string; label: string };

export const TopicContext = React.createContext<TopicHeader | null>(null);

export function useTopic() {
  return React.useContext(TopicContext);
}
