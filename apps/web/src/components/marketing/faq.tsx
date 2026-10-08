import * as React from "react";
import { getTranslations } from "next-intl/server";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export async function Faq() {
  const t = await getTranslations("marketing");
  return (
    <section id="faq" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-sm font-medium text-brand-ink">{t("faqEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("faqTitle")}</h2>
        </div>
        <Accordion type="single" collapsible className="glass glass-edge rounded-card-lg px-6">
          {KEYS.map((k) => (
            <AccordionItem key={k} value={k} className="border-glass-border">
              <AccordionTrigger className="py-5 text-base">{t(`faq_${k}`)}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base text-ink-muted">{t(`faq_${k}_a`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
