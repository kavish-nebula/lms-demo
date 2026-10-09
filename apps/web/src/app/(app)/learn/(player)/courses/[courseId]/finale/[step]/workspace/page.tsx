import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse, getFinale, getProject } from "@/data";
import { ProjectWorkspace } from "@/components/project/workspace";

type Params = { courseId: string; step: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course ? `Mini project workspace · ${course.title}` : "Mini project workspace" };
}

/** The mini project workspace, full screen: /learn/courses/[courseId]/finale/capstone/workspace, for courses whose project is built in the browser. */
export default async function ProjectWorkspacePage({ params }: { params: Promise<Params> }) {
  const { courseId, step } = await params;
  if (step !== "capstone") notFound();
  const [course, finale, project] = await Promise.all([getCourse(courseId), getFinale(courseId), getProject(courseId)]);
  if (!course || !finale || !project) notFound();
  const base = `/learn/courses/${courseId}/finale`;
  return <ProjectWorkspace course={course} project={project} block={finale.capstone} briefHref={`${base}/capstone`} finalHref={`${base}/final-check`} />;
}
