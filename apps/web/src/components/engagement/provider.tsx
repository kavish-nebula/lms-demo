"use client";
import * as React from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api, ApiRequestError } from "@/lib/api";
import { useLocalPrefix, writeLocal } from "@/lib/local-store";
import { draftChanges } from "@/lib/pending-drafts";
import type { EngagementView, StudyLog, PlatformMetric } from "@/lib/engagement";
import type { Course } from "@/data/types";

export type LogInput = Pick<StudyLog,"id" | "date" | "courseId" | "minutes" | "reflection">;
type Pending = { log: LogInput; error?: string; waiting?: boolean };
type Context = { courses: Course[]; data?: EngagementView; error?: Error; pending: Pending[]; request: (path: string, method: string, body?: unknown) => Promise<EngagementView>; log: (input: LogInput) => Promise<void>; retry: () => Promise<void>; discard: (id: string) => void; refresh: () => void; track: (kind: PlatformMetric) => void };
const PlatformContext = React.createContext<Context | null>(null);
export const useEngagement = () => React.useContext(PlatformContext);

/** Mounted only in the learner shell when the server flag is enabled. */
export function EngagementProvider({ userId, courses, children }: { userId: string; courses: Course[]; children: React.ReactNode }) {
  const t = useTranslations("engagement");
  const zone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",[]);
  const endpoint = `/api/v1/me/engagement?timezone=${encodeURIComponent(zone)}`;
  const { data, error, mutate } = useSWR<EngagementView>(endpoint,(url: string) => api(url), { revalidateOnFocus: true });
  const queueKey = `lms-engagement:v2:${userId}:pending:`;
  const drafts = useLocalPrefix<Pending>(queueKey);
  const pending = React.useMemo(() => Object.values(drafts).filter((item) => item?.log?.id),[drafts]);
  React.useEffect(() => {
    const legacyKey = `lms-engagement:v1:${userId}:pending`;
    try {
      const legacy = JSON.parse(localStorage.getItem(legacyKey) ?? "[]") as Pending[];
      if (!Array.isArray(legacy) || !legacy.length) return;
      for (const item of legacy) {
        if (!item?.log?.id) return;
        const key = queueKey + item.log.id;
        if (!localStorage.getItem(key)) writeLocal(key,JSON.stringify(item));
        if (!localStorage.getItem(key)) return;
      }
      writeLocal(legacyKey,null);
    } catch { /* Retain old drafts if storage is blocked. */ }
  },[queueKey,userId]);
  const busy = React.useRef(false);
  const track = React.useCallback((kind: PlatformMetric) => { void api("/api/v1/me/engagement/events",{ method: "POST",body: { id: crypto.randomUUID(),kind } }).catch(() => {}); },[]);
  const current = React.useRef(data); React.useEffect(() => { current.current = data; },[data]);
  const queue = React.useRef(pending); React.useEffect(() => { queue.current = pending; },[pending]);
  const store = React.useCallback((items: Pending[]) => {
    for (const change of draftChanges(queue.current,items)) {
      const key = queueKey + change.id;
      writeLocal(key,change.value);
      if (localStorage.getItem(key) !== change.value) throw new Error(t("storageError"));
    }
    queue.current = items;
  },[queueKey,t]);
  const request = React.useCallback(async (path: string, method: string, body?: unknown) => {
    const before = current.current;
    const result = await api<EngagementView>(path,{ method, body });
    if ((result.state.revision ?? 0) < (current.current?.state.revision ?? 0)) return result;
    current.current = result; await mutate(result,{ revalidate: false });
    if (method !== "GET" && before && result.points > before.points && result.state.showRewards && result.state.celebrations && !document.documentElement.classList.contains("reduce-motion") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) toast.success(t("earned",{ points: result.points - before.points }),{ duration: 2000 });
    return result;
  },[mutate,t]);
  const retry = React.useCallback(async () => {
    if (busy.current) return; busy.current = true;
    try {
      while (queue.current.some((p) => !p.error)) {
        const item = queue.current.find((p) => !p.error)!;
        try { await request("/api/v1/me/study-logs","POST",item.log); store(queue.current.filter((p) => p.log.id !== item.log.id)); if (item.waiting) track("sync_recovered"); }
        catch (e) {
          if (e instanceof ApiRequestError && e.status < 500) store(queue.current.map((p) => p.log.id === item.log.id ? { ...p,error: e.message } : p));
          else { store(queue.current.map((p) => p.log.id===item.log.id ? { ...p,waiting: true } : p)); break; }
        }
      }
    } finally { busy.current = false; }
  },[request,store,track]);
  const log = React.useCallback(async (input: LogInput) => {
    store([...queue.current.filter((p) => p.log.id !== input.id),{ log: input }]);
    await retry();
    const item = queue.current.find((p) => p.log.id === input.id);
    if (item?.error) throw new Error(item.error);
    if (item) toast.info(t("syncError"));
  },[store,retry,t]);
  const loaded = !!data;
  const visitId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!loaded) return;
    if (!visitId.current) { visitId.current = crypto.randomUUID(); void api("/api/v1/me/engagement/events",{ method: "POST",body: { id: visitId.current,kind: "visit" } }).catch(() => {}); }
    const reconcile = () => { void request("/api/v1/me/engagement/reconcile","POST").catch(() => {}); void retry(); };
    const online = () => { reconcile(); };
    reconcile(); window.addEventListener("focus",reconcile); window.addEventListener("online",online);
    return () => { window.removeEventListener("focus",reconcile); window.removeEventListener("online",online); };
  // Reconcile once on shell entry, not every SWR update.
  },[loaded,request,retry,track]);
  const value: Context = { courses,data,error,pending,request,log,retry,discard: (id) => store(queue.current.filter((p) => p.log.id !== id)),refresh: () => { void mutate(); },track };
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}
