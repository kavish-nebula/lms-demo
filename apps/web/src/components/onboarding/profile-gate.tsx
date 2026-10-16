"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile";

/**
 * "About you" comes first: a learner whose profile has not been set yet is
 * sent to Pip's welcome chat, then back to where they were going. Only when
 * the server has answered: a failed request never redirects.
 */
export function ProfileGate() {
  const { profile, loaded } = useProfile();
  const path = usePathname();
  const router = useRouter();
  React.useEffect(() => {
    if (loaded && !profile && !path.startsWith("/learn/welcome")) router.replace(`/learn/welcome?return=${encodeURIComponent(path)}`);
  }, [loaded, profile, path, router]);
  return null;
}
