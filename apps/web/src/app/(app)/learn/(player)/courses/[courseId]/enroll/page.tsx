import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FIXTURE_TODAY, getAuthoredModuleIds, getCourse, getLearner, getPrecheck } from "@/data";
import { EnrollFlow, type EnrollPhase } from "@/components/enroll/enroll-flow";

type Params = { courseId: string };
type Search = { step?: string };

const STEPS: EnrollPhase[] = ["profile", "precheck", "customize"];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course ? `Set up · ${course.title}` : "Set up" };
}

/**
 * Enrolling: /learn/courses/[courseId]/enroll (focused layout, no sidebar).
 * About you -> quick check -> customise -> build. `?step=` opens one step,
 * e.g. from "Edit setup" or "Retake the quick check".
 */
export default async function EnrollPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ courseId }, { step }] = await Promise.all([params, searchParams]);
  const [course, precheck, learner, authored] = await Promise.all([
    getCourse(courseId),
    getPrecheck(courseId),
    getLearner(),
    getAuthoredModuleIds(courseId),
  ]);
  if (!course) notFound();
  return (
    <EnrollFlow
      course={course}
      precheckItems={precheck?.items ?? []}
      name={learner.user.name.split(" ")[0] ?? learner.user.name}
      today={FIXTURE_TODAY}
      authoredModules={authored}
      initialPhase={STEPS.includes(step as EnrollPhase) ? (step as EnrollPhase) : undefined}
    />
  );
}
