import { getTranslations } from "next-intl/server";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { TickerTape } from "@/components/kit/ticker-tape";
import { MethodBento } from "@/components/marketing/method-bento";
import { RulesBento } from "@/components/marketing/rules-bento";
import { Teams } from "@/components/marketing/teams";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getCourses } from "@/data";
import { moduleTopics } from "@/lib/topics";

/** S0 Marketing home (Aurora theme). */
export default async function HomePage() {
  const t = await getTranslations("marketing");
  const tc = await getTranslations("common");
  const course = (await getCourses())[0]!;
  const first = course.modules[0]!;
  const preview = {
    course: course.title,
    module: first.title,
    topics: moduleTopics(first).map((x) => ({ stage: x.stage, title: x.title })),
  };
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero preview={preview} />
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <TickerTape
            label={t("marqueeLabel")}
            pauseLabel={tc("tickerPause")}
            playLabel={tc("tickerPlay")}
            duration={42}
            className="text-base"
            items={[
              t("mq_worked"),
              t("mq_retrieval"),
              t("mq_spacing"),
              t("mq_interleaving"),
              t("mq_mastery"),
              t("mq_load"),
              t("mq_feedback"),
              t("mq_reflection"),
            ].map((m) => ({ id: m, content: <span className="text-ink-muted">{m}</span> }))}
          />
        </div>
        <MethodBento />
        <RulesBento />
        <Teams />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
