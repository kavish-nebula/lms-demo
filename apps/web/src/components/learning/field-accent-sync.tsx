"use client";

import * as React from "react";
import { useProfile } from "@/lib/profile";
import { accentFor, applyFieldAccent } from "@/lib/field-accent";

/** Keeps the accent colour in step with the field in the learner's saved profile. */
export function FieldAccentSync() {
  const { profile, ready } = useProfile();
  const accent = accentFor(profile?.answers);
  React.useEffect(() => {
    if (ready) applyFieldAccent(accent);
  }, [ready, accent]);
  return null;
}
