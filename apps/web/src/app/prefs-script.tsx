import { InlineScript } from "@/app/inline-script";
import { prefsScript } from "@/lib/prefs";

/**
 * Applies saved preferences before first paint so nothing flashes:
 * larger text, reduced motion, and (in the app only) the light theme.
 * The app renders dark by default; `allowLight` lets the Settings choice apply.
 */
export function PrefsScript({ allowLight = false }: { allowLight?: boolean }) {
  return <InlineScript html={prefsScript(allowLight)} />;
}
