import { AppShell } from "@/components/shell/app-shell";
import { getCourses, getLearner } from "@/data";

/** Learner app frame. Role comes from the session once auth exists. */
export default async function LearnShellLayout({ children }: { children: React.ReactNode }) {
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);

  return (
    <AppShell
      role="learner"
      heldRoles={["learner"]}
      user={{ name: learner.user.name, email: learner.user.email }}
      courses={courses.map((c) => ({ id: c.course_id, title: c.title, href: `/learn/courses/${c.course_id}` }))}
      notifications={[
        ...learner.assignments.map((a) => ({
          id: a.id,
          title: a.title,
          detail: `${a.assigned_by} · due ${a.due}`,
          href: "/learn/courses",
          unread: false,
        })),
      ]}
      settingsHref="/learn/settings"
    >
      {children}
    </AppShell>
  );
}
