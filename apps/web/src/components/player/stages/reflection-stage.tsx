"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/kit/surface";
import { useDraft } from "@/components/player/progress";

/** Sentences of at least three words, so "ok." does not count. */
export function countSentences(text: string) {
  return text
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3).length;
}

/**
 * One reflection prompt: what worked, what failed, what transfers (ch13 T6).
 * Graded for completion only; the draft is kept locally so nothing is lost
 * on reload. Used by the course wrap-up.
 */
export function ReflectionPrompt({
  id,
  index,
  label,
  text,
  min,
  disabled,
  onCount,
}: {
  id: string;
  index: number;
  label: string;
  text: string;
  min: number;
  disabled?: boolean;
  onCount: (n: number) => void;
}) {
  const t = useTranslations("player");
  const [value, setValue] = useDraft(`reflect:${id}`);
  const n = countSentences(value);
  React.useEffect(() => onCount(n), [n, onCount]);
  const fieldId = `reflect-${index}`;

  return (
    <Surface pad="md" className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-stage-reflection">{label}</div>
      <Label htmlFor={fieldId} className="text-base leading-relaxed font-normal">
        {text}
      </Label>
      <Textarea
        id={fieldId}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${fieldId}-count`}
      />
      <div id={`${fieldId}-count`} className={cn("text-xs", n >= min ? "text-ok" : "text-ink-faint")}>
        {t("sentencesCount", { count: n, min })}
      </div>
    </Surface>
  );
}
