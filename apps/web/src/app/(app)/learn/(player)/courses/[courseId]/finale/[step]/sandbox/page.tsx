import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse, getFinale } from "@/data";
import { CapstoneWorkspace } from "@/components/sandbox/workspace";

type Params = { courseId: string; step: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course ? `Capstone sandbox · ${course.title}` : "Capstone sandbox" };
}

/** The capstone sandbox, full screen: /learn/courses/[courseId]/finale/capstone/sandbox. Only the capstone has one. */
export default async function CapstoneSandboxPage({ params }: { params: Promise<Params> }) {
  const { courseId, step } = await params;
  if (step !== "capstone") notFound();
  const [course, finale] = await Promise.all([getCourse(courseId), getFinale(courseId)]);
  if (!course || !finale) notFound();
  return <CapstoneWorkspace courseId={courseId} block={finale.capstone} briefHref={`/learn/courses/${courseId}/finale/capstone`} />;
}
