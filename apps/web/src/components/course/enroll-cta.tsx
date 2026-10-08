"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Play, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnrollment } from "@/lib/enrollment";
import { useCourseProgress } from "@/lib/course-progress";
import type { Course } from "@/data/types";

/**
 * The course's primary action. Not enrolled: "Enroll for free" opens the
 * six-question setup. Enrolled: "Continue" resumes at the next stage, with
 * "Edit setup" alongside.
 */
export function EnrollCta({
  course,
  size = "lg",
  showEdit = true,
  className,
}: {
  course: Course;
  size?: "sm" | "lg" | "xl";
  showEdit?: boolean;
  className?: string;
}) {
  const t = useTranslations("course");
  const { enrolled } = useEnrollment(course.course_id);
  const progress = useCourseProgress(course);
  const base = `/learn/courses/${course.course_id}`;

  if (!enrolled) {
    return (
      <Button asChild size={size} variant="brand" className={className}>
        <Link href={`${base}/enroll`}>
          <Sparkles data-icon="inline-start" />
          {t("enrollFree")}
        </Link>
      </Button>
    );
  }

  const href = progress.complete ? `${base}/finale/wrap-up` : (progress.resume?.href ?? base);
  const label = progress.complete ? t("viewResults") : progress.topicsDone ? t("continueCourse") : t("startCourse");
  return (
    <span className={className ? `inline-flex flex-wrap items-center gap-2 ${className}` : "inline-flex flex-wrap items-center gap-2"}>
      <Button asChild size={size} variant="brand">
        <Link href={href}>
          <Play data-icon="inline-start" />
          {label}
        </Link>
      </Button>
      {showEdit ? (
        <Button asChild size={size === "xl" ? "lg" : size} variant="outline" className="bg-transparent">
          <Link href={`${base}/enroll`}>
            <Settings2 data-icon="inline-start" />
            {t("editSetup")}
          </Link>
        </Button>
      ) : null}
    </span>
  );
}

/** One-line note under the hero CTA, shown only before enrolment. */
export function EnrollNote({ course, children }: { course: Course; children: React.ReactNode }) {
  const { enrolled } = useEnrollment(course.course_id);
  return enrolled ? null : <p className="text-sm text-ink-faint">{children}</p>;
}
