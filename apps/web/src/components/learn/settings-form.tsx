"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { clearLocal, useLocalJson, writeLocal } from "@/lib/local-store";
import { api, refreshEnrollments, storeProfile } from "@/lib/api";
import { Surface } from "@/components/kit/surface";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Prefs = {
  theme: "dark" | "light";
  locale: string;
  reduceMotion: boolean;
  textScale: "normal" | "large";
  reminders: boolean;
  microphone: boolean;
};

const DEFAULTS: Prefs = { theme: "dark", locale: "en", reduceMotion: false, textScale: "normal", reminders: false, microphone: false };
const KEY = "lms-prefs";

function save(p: Prefs) {
  writeLocal(KEY, JSON.stringify(p));
  const root = document.documentElement;
  root.classList.toggle("text-lg", p.textScale === "large");
  root.classList.toggle("reduce-motion", p.reduceMotion);
  if (p.theme === "light") delete root.dataset.theme;
  else root.dataset.theme = "aurora";
}

/**
 * Learner settings (S5). Accessibility settings apply immediately to <html>;
 * persisted locally until the profile API exists (PATCH /v1/me/settings).
 */
export function SettingsForm({ languages }: { languages: { code: string; label: string; available: boolean }[] }) {
  const t = useTranslations("settings");
  const stored = useLocalJson<Partial<Prefs>>(KEY, {});
  const prefs: Prefs = { ...DEFAULTS, ...stored };

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    save({ ...prefs, [key]: value });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Surface pad="lg" className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">{t("language")}</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="locale">{t("languageLabel")}</Label>
          <Select value={prefs.locale} onValueChange={(v) => update("locale", v)}>
            <SelectTrigger id="locale" className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code} disabled={!l.available}>
                  {l.label}
                  {!l.available ? ` · ${t("comingSoon")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-ink-faint">{t("languageHelp")}</p>
        </div>
      </Surface>

      <Surface pad="lg" className="flex flex-col gap-1">
        <h2 className="mb-3 text-lg font-semibold">{t("appearance")}</h2>
        <SettingRow
          id="light-theme"
          label={t("lightTheme")}
          help={t("lightThemeHelp")}
          checked={prefs.theme === "light"}
          onChange={(v) => update("theme", v ? "light" : "dark")}
        />
      </Surface>

      <Surface pad="lg" className="flex flex-col gap-1">
        <h2 className="mb-3 text-lg font-semibold">{t("accessibility")}</h2>
        <SettingRow
          id="reduce-motion"
          label={t("reduceMotion")}
          help={t("reduceMotionHelp")}
          checked={prefs.reduceMotion}
          onChange={(v) => update("reduceMotion", v)}
        />
        <SettingRow
          id="text-scale"
          label={t("textScale")}
          help={t("textScaleHelp")}
          checked={prefs.textScale === "large"}
          onChange={(v) => update("textScale", v ? "large" : "normal")}
        />
      </Surface>

      <Surface pad="lg" className="flex flex-col gap-1">
        <h2 className="mb-3 text-lg font-semibold">{t("privacy")}</h2>
        <SettingRow
          id="reminders"
          label={t("reminders")}
          help={t("remindersHelp")}
          checked={prefs.reminders}
          onChange={(v) => update("reminders", v)}
        />
        <SettingRow
          id="microphone"
          label={t("microphone")}
          help={t("microphoneHelp")}
          checked={prefs.microphone}
          onChange={(v) => update("microphone", v)}
        />
      </Surface>

      <Surface pad="lg" className="flex flex-wrap items-center justify-between gap-4 border-err-line">
        <div>
          <h2 className="font-semibold">{t("resetDemo")}</h2>
          <p className="text-sm text-ink-muted">{t("resetHelp")}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">{t("resetDemo")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("resetConfirmTitle")}</DialogTitle>
              <DialogDescription>{t("resetConfirmBody")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("cancel")}</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await api("/api/v1/me/data", { method: "DELETE" });
                    } catch {
                      toast.error(t("resetFailed"));
                      return;
                    }
                    clearLocal("lms-");
                    save(DEFAULTS);
                    await Promise.all([refreshEnrollments(), storeProfile(null)]);
                    toast.success(t("resetDone"));
                  }}
                >
                  {t("resetConfirm")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Surface>
    </div>
  );
}

function SettingRow({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-line py-4 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-base font-medium">
          {label}
        </Label>
        <p id={`${id}-help`} className="mt-0.5 text-sm text-ink-muted">
          {help}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-help`} />
    </div>
  );
}
