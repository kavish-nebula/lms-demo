"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState } from "@/components/kit/states";
import { useHydrated, useLocalJson } from "@/lib/local-store";
import type { GateResult } from "@/data/mock-grader";

type PreviousModule = { moduleId: string; title: string };

/** Enforces the quiz sequence for direct URLs as well as course navigation. */
export function ModuleLock({
  courseId,
  moduleTitle,
  previous,
  children,
}: {
  courseId: string;
  moduleTitle: string;
  previous?: PreviousModule;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const result = useLocalJson<GateResult | null>(
    `lms-gate:v1:${courseId}:gate-${previous?.moduleId ?? "first"}`,
    null,
  );

  if (!previous) return children;
  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center page-pad py-10">
        <CardSkeleton lines={5} className="w-full" />
      </main>
    );
  }
  if (result?.passed) return children;

  const base = `/learn/courses/${courseId}`;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center page-pad py-10">
      <EmptyState
        icon={<LockKeyhole />}
        title={`${moduleTitle} is locked`}
        description={`Pass the ${previous.title} module quiz to unlock this module.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="brand">
              <Link href={`${base}/${previous.moduleId}/gate`}>
                Go to module quiz
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={base}>Course map</Link>
            </Button>
          </div>
        }
        className="w-full"
      />
    </main>
  );
}
