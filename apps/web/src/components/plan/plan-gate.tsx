"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarRange } from "lucide-react";
import { CardSkeleton, EmptyState } from "@/components/kit/states";
import { Button } from "@/components/ui/button";
import { PlanBoard, type PlanBoardProps } from "@/components/plan/plan-board";
import { useEnrollments } from "@/lib/enrollment";
import { useLearnerReady } from "@/lib/api";

/** Plans only cover enrolled courses. Before enrolment, point to the catalog. */
export function PlanGate({ courses, ...rest }: PlanBoardProps) {
  const t = useTranslations("plan");
  const hydrated = useLearnerReady();
  const enrollments = useEnrollments();
  const enrolled = React.useMemo(() => courses.filter((c) => enrollments[c.course_id]), [courses, enrollments]);

  if (!hydrated) return <CardSkeleton lines={5} />;
  if (!enrolled.length) {
    return (
      <EmptyState
        icon={<CalendarRange />}
        title={t("notEnrolledTitle")}
        description={t("notEnrolledBody")}
        action={
          <Button asChild variant="brand">
            <Link href="/learn/courses">{t("browseCourses")}</Link>
          </Button>
        }
      />
    );
  }
  return <PlanBoard courses={enrolled} {...rest} />;
}
