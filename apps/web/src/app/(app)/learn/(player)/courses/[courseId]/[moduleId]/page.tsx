import { notFound, redirect } from "next/navigation";
import { getCourse } from "@/data";

type Params = { courseId: string; moduleId: string };

/** /learn/courses/[courseId]/[moduleId] -> the learner's current stage, or the first one. */
export default async function ModuleIndexPage({ params }: { params: Promise<Params> }) {
  const { courseId, moduleId } = await params;
  const course = await getCourse(courseId);
  const m = course?.modules.find((x) => x.module_id === moduleId);
  if (!m) notFound();
  redirect(`/learn/courses/${courseId}/${moduleId}/${m.current_stage ?? m.stages[0]}`);
}
