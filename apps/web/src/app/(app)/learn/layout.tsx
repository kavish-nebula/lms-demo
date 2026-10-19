import { getCourses, getModule } from "@/data";
import { coursePassages } from "@/lib/companion";
import { CourseCompanionProvider } from "@/components/learning/course-companion";
import { FieldAccentSync } from "@/components/learning/field-accent-sync";
import { AgentVoiceProvider } from "@/components/agent/agent-voice";
import { ProfileGate } from "@/components/onboarding/profile-gate";
import type { ModuleContent } from "@/data/types";

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const courses = await getCourses();
  const catalog = await Promise.all(courses.map(async (course) => {
    const modules = (await Promise.all(course.modules.map((m) => getModule(course.course_id, m.module_id)))).filter((m): m is ModuleContent => !!m);
    return { course, passages: coursePassages(course, modules) };
  }));
  return (
    <CourseCompanionProvider catalog={catalog}>
      <ProfileGate />
      <FieldAccentSync />
      <AgentVoiceProvider>{children}</AgentVoiceProvider>
    </CourseCompanionProvider>
  );
}
