import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { fontClassName } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { PrefsScript } from "@/app/prefs-script";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nebula KnowLab",
    template: "%s · Nebula KnowLab",
  },
  description: "Evidence-based learning, one module at a time.",
};

/**
 * Root layout for every signed-in surface. Dark "Aurora" theme by default;
 * learners can switch to the light "Frosted Aura" theme in Settings, applied
 * before paint by PrefsScript. Marketing and auth have their own root layout.
 */
export default async function AppRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-theme="aurora"
      className={`${fontClassName} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <PrefsScript allowLight />
      </head>
      <body className="aura flex min-h-dvh flex-col antialiased">
        <Providers locale={locale} messages={messages} themeable>
          {children}
        </Providers>
      </body>
    </html>
  );
}
