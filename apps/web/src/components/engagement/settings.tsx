"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Surface } from "@/components/kit/surface";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEngagement } from "./provider";
export function EngagementSettings() {
  const t = useTranslations("engagement"); const p = useEngagement(); const [error,setError] = React.useState(""); const [busy,setBusy] = React.useState(false); const [zone,setZone] = React.useState("");
  if (!p?.data) return null;
  const state = p.data.state;
  async function update(body: unknown) { if (!p) return; setBusy(true); setError(""); try { await p.request("/api/v1/me/engagement/preferences","PATCH",body); } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setBusy(false); } }
  return <Surface pad="lg" className="flex max-w-3xl flex-col gap-5"><h2 className="text-lg font-semibold">{t("activitySettings")}</h2><p className="text-sm text-ink-muted">{t("persistence")}</p>
    {(["showRewards","celebrations"] as const).map((key) => <div className="flex items-center justify-between gap-3" key={key}><Label htmlFor={`engagement-${key}`}>{t(key)}</Label><Switch disabled={busy} id={`engagement-${key}`} checked={state[key]} onCheckedChange={(value) => { void update({ [key]: value }); }} /></div>)}
    <div><Label htmlFor="engagement-cosmetic">{t("cosmetic")}</Label><select disabled={busy} id="engagement-cosmetic" value={state.cosmetic} onChange={(e) => { void update({ cosmetic: e.target.value }); }} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink focus-visible:outline-2 focus-visible:outline-brand"><option value="default">{t("default")}</option>{state.unlocked.map((id) => <option key={id} value={id}>{t(id as "orbit" | "constellation" | "nebula")}</option>)}</select></div>
    <form onSubmit={(e) => { e.preventDefault(); void update({ timezone: zone || state.timezone }); }}><Label htmlFor="activity-timezone">{t("timezone")}</Label><Input id="activity-timezone" className="mt-2 min-h-11" placeholder={state.timezone} value={zone} onChange={(e) => setZone(e.target.value)} aria-describedby="timezone-description" /><p id="timezone-description" className="mt-2 text-sm text-ink-muted">{state.timezone}. {t("timezoneHelp")}</p><Button disabled={busy} className="mt-3 min-h-11" type="submit">{busy ? t("saving") : t("savePreferences")}</Button></form>
    {error ? <p role="alert" className="text-err">{error}</p> : null}<p className="text-sm text-ink-muted">{t("resetScope")}</p>
  </Surface>;
}
