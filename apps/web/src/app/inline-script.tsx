"use client";

/**
 * Inline script that runs during HTML parsing on hard loads, without React's
 * dev warning about rendering <script> on the client: the client render
 * marks it text/plain, and suppressHydrationWarning accepts the type mismatch
 * (Next.js guide "Preventing flash before hydration").
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
