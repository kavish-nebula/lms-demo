import { notFound } from "next/navigation";
import { getCourse } from "@/data";
import { WorkflowWorkspace } from "@/components/project/workflow-workspace";
export const metadata = { title: "Workflow mini project · Nebula KnowLab" };
export default async function Page({ params }: { params: Promise<{ courseId: string; step: string }> }) {
  const { courseId,step } = await params;
  const course = await getCourse(courseId);
  if (!course || courseId !== "ai-agent" || step !== "capstone") notFound();
  return <WorkflowWorkspace course={course} />;
}
