"use client";

import * as React from "react";
import { cn } from "cn";

/** What the assistant is doing: thinking shows typing dots; the others a single soft pulse. Idle is still. */
export type PipReaction = "idle" | "wave" | "point" | "think" | "celebrate";

/**
 * Pip, the course assistant: a plain round badge with a chat mark, in the
 * accent colour (so a field palette recolours it). Size it with `className`
 * (e.g. "size-10"). Motion is limited to the typing dots and one pulse, and
 * stops under reduced motion.
 */
export function AssistantAvatar({ className, reaction = "idle" }: { className?: string; reaction?: PipReaction }) {
  return (
    <span className={cn("assistant-avatar", className)} data-reaction={reaction} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.2L7.6 20.6c-.5.4-1.1 0-1.1-.6v-2.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
          fill="currentColor"
          fillOpacity=".18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle className="assistant-dot" cx="8.5" cy="11.5" r="1.25" fill="currentColor" />
        <circle className="assistant-dot" cx="12" cy="11.5" r="1.25" fill="currentColor" />
        <circle className="assistant-dot" cx="15.5" cy="11.5" r="1.25" fill="currentColor" />
      </svg>
    </span>
  );
}
