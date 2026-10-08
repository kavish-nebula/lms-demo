"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sign-in UI only. The managed IdP (ARCHITECTURE.pdf section 3) will own the
 * real flow; for now both paths lead into the demo learner account.
 */
export function SignInForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState<"email" | "sso" | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email);

  function go(kind: "email" | "sso") {
    setPending(kind);
    // Crossing root layouts triggers a full page load, which is expected here.
    setTimeout(() => router.push("/learn"), 700);
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) go("email");
        }}
      >
        <Label htmlFor="email">{t("email")}</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 bg-white/5 pl-9"
            aria-describedby="email-help"
          />
        </div>
        <p id="email-help" className="text-xs text-ink-faint">
          {t("emailHelp")}
        </p>
        <Button type="submit" size="xl" variant="brand" disabled={!valid || !!pending}>
          {pending === "email" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {t("continueEmail")}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button variant="outline" size="xl" className="bg-transparent" disabled={!!pending} onClick={() => go("sso")}>
        {pending === "sso" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Building2 data-icon="inline-start" />}
        {t("sso")}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        {t("invite")}{" "}
        <Link href="/learn" className="font-medium text-brand-ink underline-offset-4 hover:underline">
          {t("demo")}
        </Link>
      </p>
    </div>
  );
}
