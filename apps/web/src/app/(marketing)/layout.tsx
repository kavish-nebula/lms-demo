import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { fontClassName } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { PrefsScript } from "@/app/prefs-script";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nebula KnowLab · Learn it once. Keep it.",
    template: "%s · Nebula KnowLab",
  },
  description:
    "Every module follows nine evidence-based steps, from a real problem to a spaced review weeks later.",
};

/**
 * Root layout for the public site and auth screens. The dark "Aurora" theme
 * is set on <html> so portals (dialogs, toasts) inherit it too.
 */
export default async function MarketingRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-theme="aurora" className={`${fontClassName} h-full`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <PrefsScript />
      </head>
      <body className="aura flex min-h-dvh flex-col antialiased">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
