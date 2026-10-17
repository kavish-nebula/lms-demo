import { getCourses, getModule } from "@/data";
import { coursePassages } from "@/lib/companion";
import { CourseCompanionProvider } from "@/components/learning/course-companion";
import { AgentVoiceProvider } from "@/components/agent/agent-voice";
import type { ModuleContent } from "@/data/types";

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const courses = await getCourses();
  const catalog = await Promise.all(courses.map(async (course) => {
    const modules = (await Promise.all(course.modules.map((m) => getModule(course.course_id, m.module_id)))).filter((m): m is ModuleContent => !!m);
    return { course, passages: coursePassages(course, modules) };
  }));
  // the learner's agent speaks along the journey (components/agent/agent-voice.tsx)
  return (
    <CourseCompanionProvider catalog={catalog}>
      <AgentVoiceProvider>{children}</AgentVoiceProvider>
    </CourseCompanionProvider>
  );
}
