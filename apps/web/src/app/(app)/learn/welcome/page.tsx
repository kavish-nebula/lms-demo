import type { Metadata } from "next";
import { getLearner } from "@/data";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";

export const metadata: Metadata = { title: "Welcome" };

type Search = { return?: string };

/** Only paths inside the app: `return` comes from the URL. */
const safeReturn = (r: string | undefined) => (r && r.startsWith("/learn") && !r.startsWith("//") ? r : null);

/**
 * /learn/welcome: "About you" with Pip, right after signing in. ProfileGate
 * sends a learner without a profile here (with `return` set to where they
 * were going); "Edit profile" links come here too.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ return: back }, learner] = await Promise.all([searchParams, getLearner()]);
  return <WelcomeFlow name={learner.user.name.split(" ")[0] ?? learner.user.name} returnTo={safeReturn(back)} />;
}
