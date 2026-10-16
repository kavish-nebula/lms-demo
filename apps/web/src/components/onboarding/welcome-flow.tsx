"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Logo } from "@/components/kit/logo";
import { CardSkeleton } from "@/components/kit/states";
import { InterviewChat, type InterviewState } from "@/components/onboarding/interview-chat";
import { api } from "@/lib/api";
import { applyComfort, useProfile } from "@/lib/profile";
import { profilePart, type SetupAnswers } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";

type Saved = { answers: SetupAnswers; needs: string[]; derived: ProfileDerived | null };

/**
 * "About you", right after signing in: an interview with Pip, written by the
 * language model for each learner (InterviewChat). It resumes from the
 * server's draft, else starts fresh; a saved profile without an interview
 * (from before) is asked again. Finishing saves the profile and the comfort
 * settings, then goes on to `returnTo` (the dashboard, or the screen that sent
 * the learner here, such as a course's setup).
 */
export function WelcomeFlow({ name, returnTo }: { name: string; returnTo: string | null }) {
  const t = useTranslations("enroll");
  const router = useRouter();
  const { save } = useProfile();
  const [initial, setInitial] = React.useState<Saved | null>(null);

  React.useEffect(() => {
    let live = true;
    api<{ profiling: Saved | null }>("/api/v1/profiling")
      .then(({ profiling }) => live && setInitial(profiling?.answers.interview?.length ? profiling : { answers: {}, needs: profiling?.needs ?? [], derived: null }))
      .catch(() => live && setInitial({ answers: {}, needs: [], derived: null }));
    return () => {
      live = false;
    };
  }, []);

  const next = returnTo ?? "/learn";
  const continueLabel = returnTo && returnTo !== "/learn" ? t("welcomeBack") : t("welcomeToDashboard");

  async function done(s: Pick<InterviewState, "answers" | "needs">) {
    try {
      // the server normalises with the derived result it kept for this interview
      await save(profilePart(s.answers), s.needs);
    } catch {
      toast.error(t("profileSaveFailed"));
      return;
    }
    applyComfort(s.needs.includes("none") ? [] : s.needs);
    router.push(next);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-4 page-pad">
          <Logo wordmark={false} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-muted">{t("welcomeKicker")}</div>
            <div className="truncate font-semibold">{t("welcomeTitle")}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 page-pad py-8 lg:py-12">
        {!initial ? <CardSkeleton lines={6} /> : <InterviewChat name={name} initial={initial} continueLabel={continueLabel} onDone={(s) => void done(s)} />}
      </main>
    </div>
  );
}
