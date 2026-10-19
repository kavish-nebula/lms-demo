import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { MethodBento } from "@/components/marketing/method-bento";
import { RulesBento } from "@/components/marketing/rules-bento";
import { Teams } from "@/components/marketing/teams";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getCourses } from "@/data";
import { moduleTopics } from "@/lib/topics";

/** S0 Marketing home (Aurora theme). */
export default async function HomePage() {
  // the hero previews the first course's first module, when there is one
  const course = (await getCourses())[0];
  const first = course?.modules[0];
  const preview =
    course && first
      ? {
          course: course.title,
          module: first.title,
          modules: course.modules.length,
          topics: moduleTopics(first).map((x) => ({ stage: x.stage, title: x.title })),
        }
      : null;
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero preview={preview} />
        <MethodBento />
        <RulesBento />
        <Teams />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
