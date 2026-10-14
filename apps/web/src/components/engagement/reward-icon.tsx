import { Orbit, Stars, Sparkles } from "lucide-react";
/** Cosmetic icons are decorative and never communicate a learning level. */
export function RewardIcon({ cosmetic }: { cosmetic: string }) {
  const Icon = cosmetic === "constellation" ? Stars : cosmetic === "nebula" ? Sparkles : Orbit;
  return <Icon className="size-6 text-brand-ink" aria-hidden />;
}
