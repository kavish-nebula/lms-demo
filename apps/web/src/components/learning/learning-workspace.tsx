"use client";
import * as React from "react";

/**
 * The frame around a lesson topic. It used to carry a phase strip and a
 * guidance picker above the lesson; both were removed. The module outline and
 * the Back/Next buttons move between topics, and help follows the learner's
 * setup and practice automatically.
 */
export function LearningWorkspace({ children }: { children: React.ReactNode }) {
  return <div className="learning-workspace">{children}</div>;
}
