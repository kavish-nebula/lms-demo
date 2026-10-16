import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/data";
import { WorkflowWorkspace } from "@/components/project/workflow-workspace";

type Params = { courseId: string; step: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course ? `Mini project workspace · ${course.title}` : "Mini project workspace" };
}

/** The mini project workspace, full screen: /learn/courses/[courseId]/finale/capstone/workspace, where the learner builds the agent's workflow. */
export default async function ProjectWorkspacePage({ params }: { params: Promise<Params> }) {
  const { courseId, step } = await params;
  const course = await getCourse(courseId);
  if (!course || courseId !== "ai-agent" || step !== "capstone") notFound();
  return <WorkflowWorkspace course={course} />;
}
