import type { Metadata } from "next";
import { getCourses } from "@/data";
import { KitShowcase } from "@/components/kit/kit-showcase";
import type { Credential } from "@/data/types";

export const metadata: Metadata = { title: "Component kit" };

/** Static demo credential: the learner fixture has none until a gate is passed. */
const DEMO_CREDENTIAL: Credential = {
  credential_id: "kit-demo",
  kind: "module",
  title: "Module 1 complete",
  course_title: "Sample course",
  issued_at: "2026-10-01",
  verify_url: "/verify/kit-demo",
};

export default async function KitPage() {
  const courses = await getCourses();
  return <KitShowcase course={courses[0]} credential={DEMO_CREDENTIAL} />;
}
