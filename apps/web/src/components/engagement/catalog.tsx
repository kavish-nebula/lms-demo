"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ProgramCard } from "@/components/course/program-card";
import { useEnrollments } from "@/lib/enrollment";
import { useEngagement } from "./provider";
import type { Course } from "@/data/types";
export function CatalogExplorer({ courses }: { courses: Course[] }) {
  const t = useTranslations("engagement"); const p = useEngagement(); const enrolled = useEnrollments(); const params = useSearchParams(); const router = useRouter();
  const query = params.get("q") ?? ""; const filter = params.get("filter") ?? "all";
  const [navigating,startTransition] = React.useTransition();
  const queryRef = React.useRef(new URLSearchParams(params));
  React.useEffect(() => { if (!navigating) queryRef.current = new URLSearchParams(params); },[params,navigating]);
  const [error,setError] = React.useState(""); const [busy,setBusy] = React.useState<string | null>(null);
  function change(key: string,value: string) { const next = new URLSearchParams(queryRef.current); if (value) next.set(key,value); else next.delete(key); queryRef.current = next; startTransition(() => router.replace(`/learn/courses?${next.toString()}`,{ scroll: false })); }
  const found = courses.filter((c) => `${c.title} ${c.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (filter === "enrolled" ? !!enrolled[c.course_id] : filter === "saved" ? p?.data?.state.savedCourses.includes(c.course_id) : true));
  async function toggle(id: string,saved: boolean) { if (!p) return; setBusy(id); setError(""); try { await p.request(`/api/v1/me/saved-courses/${encodeURIComponent(id)}`,saved ? "DELETE" : "PUT"); } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setBusy(null); } }
  return <div className="flex flex-col gap-5"><div><Label htmlFor="catalog-search">{t("searchCourses")}</Label><Input className="mt-2 min-h-11 max-w-xl" id="catalog-search" type="search" value={query} onChange={(e) => change("q",e.target.value)} /></div><div className="flex flex-wrap gap-2" role="group" aria-label={t("courses")}>{(["all","enrolled","saved"] as const).map((key) => <Button className="min-h-11" key={key} aria-pressed={filter===key} variant={filter===key ? "brand" : "outline"} onClick={() => change("filter",key)}>{t(key === "saved" ? "savedCourses" : key)}</Button>)}</div>
    {error ? <p className="text-err" role="alert">{error}</p> : null}
    {found.map((c) => { const saved = !!p?.data?.state.savedCourses.includes(c.course_id); return <section key={c.course_id} className="flex flex-col gap-2"><div className="flex justify-end"><Button className="min-h-11" variant="outline" disabled={!p?.data || !!busy} onClick={() => { void toggle(c.course_id,saved); }}>{t(saved ? "unsaveCourse" : "saveCourse")}</Button></div><ProgramCard course={c} /></section>; })}
    {!found.length ? <p className="rounded-lg border border-line p-6">{t("noMatches")}</p> : null}
  </div>;
}
