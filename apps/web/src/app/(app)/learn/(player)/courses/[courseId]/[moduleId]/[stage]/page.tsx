import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, FileQuestion } from "lucide-react";
import { getCourse, getModule } from "@/data";
import { Player } from "@/components/player/player";
import { EmptyState } from "@/components/kit/states";
import { Button } from "@/components/ui/button";
import { isModuleStage } from "@/lib/stages";

type Params = { courseId: string; moduleId: string; stage: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId, moduleId } = await params;
  const course = await getCourse(courseId);
  const m = course?.modules.find((x) => x.module_id === moduleId);
  return { title: m ? `${m.title} · ${course!.title}` : "Module" };
}

/**
 * S4 Player route: /learn/courses/[courseId]/[moduleId]/[stage]. The concept
 * topic is split into one part per lesson video: `?v=m1-2` opens that video
 * (without it, the first).
 */
export default async function PlayerPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ v?: string }> }) {
  const [{ courseId, moduleId, stage }, { v }] = await Promise.all([params, searchParams]);
  if (!isModuleStage(stage)) notFound();
  const course = await getCourse(courseId);
  const outline = course?.modules.find((m) => m.module_id === moduleId);
  if (!course || !outline) notFound();

  const courseHref = `/learn/courses/${courseId}`;
  const mod = await getModule(courseId, moduleId);

  if (!mod) {
    const t = await getTranslations("player");
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 page-pad py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={courseHref}>
            <ChevronLeft data-icon="inline-start" />
            {course.title}
          </Link>
        </Button>
        <EmptyState
          icon={<FileQuestion />}
          title={t("notAuthoredTitle", { module: outline.title })}
          description={t("notAuthoredBody")}
          action={
            <Button asChild variant="brand">
              <Link href={courseHref}>{t("backToCourse")}</Link>
            </Button>
          }
        />
      </main>
    );
  }

  // A topic the module does not have is a bad link; one not written yet goes to the first that is.
  if (!outline.stages.includes(stage)) notFound();
  if (!mod.stages_included.includes(stage)) {
    const first = outline.stages.find((s) => mod.stages_included.includes(s));
    if (!first) notFound();
    redirect(`${courseHref}/${moduleId}/${first}`);
  }

  const moduleIndex = course.modules.findIndex((m) => m.module_id === moduleId) + 1;
  // finishing a module opens the next one at its first written topic; after the last, the capstone
  const following = course.modules[moduleIndex];
  const after = following
    ? {
        href: `${courseHref}/${following.module_id}/${following.stages.find((s) => following.authored?.includes(s)) ?? following.stages[0]}`,
        title: following.title,
      }
    : { href: `${courseHref}/finale/${course.finale.steps[0]!.id}`, title: course.finale.steps[0]!.title };
  return (
    <Player
      module={mod}
      moduleIndex={moduleIndex}
      stage={stage}
      courseHref={courseHref}
      initialDone={[]}
      topics={outline.topics}
      video={stage === "explainer" ? v : undefined}
      after={after}
    />
  );
}
