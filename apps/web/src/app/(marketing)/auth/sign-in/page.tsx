import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/kit/logo";
import { SignInForm } from "@/components/marketing/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** S1 Sign in (Aurora). */
export default async function SignInPage() {
  const t = await getTranslations("auth");
  return (
    <main id="main" className="relative isolate flex min-h-dvh items-center justify-center overflow-x-clip px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(125,108,255,0.4),transparent)] blur-2xl"
      />
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <Logo />
        </Link>
        <div className="glass glass-edge rounded-[28px] p-7 sm:p-9">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1.5 text-ink-muted">{t("subtitle")}</p>
          <div className="mt-7">
            <SignInForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">{t("legal")}</p>
      </div>
    </main>
  );
}
