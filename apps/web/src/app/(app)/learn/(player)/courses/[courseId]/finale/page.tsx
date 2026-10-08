import { redirect } from "next/navigation";

type Params = { courseId: string };

/** /learn/courses/[courseId]/finale -> its first step. */
export default async function FinaleIndexPage({ params }: { params: Promise<Params> }) {
  const { courseId } = await params;
  redirect(`/learn/courses/${courseId}/finale/capstone`);
}
