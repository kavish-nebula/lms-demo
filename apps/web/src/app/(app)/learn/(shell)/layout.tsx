import { AppShell } from "@/components/shell/app-shell";
import { FIXTURE_TODAY, getCourses, getLearner } from "@/data";

/** Learner app frame. Role comes from the session once auth exists. */
export default async function LearnShellLayout({ children }: { children: React.ReactNode }) {
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);
  const dueToday = learner.due_reviews.filter((r) => r.due <= FIXTURE_TODAY).length;

  return (
    <AppShell
      role="learner"
      heldRoles={["learner"]}
      user={{ name: learner.user.name, email: learner.user.email }}
      courses={courses.map((c) => ({ id: c.course_id, title: c.title, href: `/learn/courses/${c.course_id}` }))}
      notifications={[
        ...learner.due_reviews.slice(0, 2).map((r) => ({
          id: r.review_item_id,
          title: r.module_title,
          detail: `${r.questions} review questions · ${r.course_title}`,
          href: "/learn/reviews",
          unread: r.due <= FIXTURE_TODAY,
        })),
        ...learner.assignments.map((a) => ({
          id: a.id,
          title: a.title,
          detail: `${a.assigned_by} · due ${a.due}`,
          href: "/learn/courses",
          unread: false,
        })),
      ]}
      badges={{ reviews: dueToday }}
      settingsHref="/learn/settings"
    >
      {children}
    </AppShell>
  );
}
