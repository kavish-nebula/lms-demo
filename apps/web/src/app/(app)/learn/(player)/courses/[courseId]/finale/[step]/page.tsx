import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthoredModuleIds, getCourse, getFinale } from "@/data";
import { FinalePlayer } from "@/components/finale/finale-player";
import { isFinaleStepId } from "@/lib/stages";

type Params = { courseId: string; step: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId, step } = await params;
  const course = await getCourse(courseId);
  const s = course?.finale.steps.find((x) => x.id === step);
  return { title: s ? `${s.kicker} · ${course!.title}` : "Course finale" };
}

/** Course finale route: /learn/courses/[courseId]/finale/[step] (capstone, final-check, wrap-up). */
export default async function FinalePage({ params }: { params: Promise<Params> }) {
  const { courseId, step } = await params;
  if (!isFinaleStepId(step)) notFound();
  const [course, finale, authored] = await Promise.all([getCourse(courseId), getFinale(courseId), getAuthoredModuleIds(courseId)]);
  if (!course || !finale) notFound();
  return <FinalePlayer course={course} finale={finale} step={step} authoredModules={authored} />;
}
