"use client";

import * as React from "react";
import { cn } from "cn";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Briefcase, Cpu, Factory, GraduationCap, HeartPulse, Landmark, ShoppingBag } from "lucide-react";
import { backdropOf, type Audience } from "@/lib/mission";

const MOTIF = { health: HeartPulse, finance: Landmark, education: GraduationCap, manufacturing: Factory, retail: ShoppingBag, it: Cpu, work: Briefcase };
/** Morning, midday, evening: each scene has its own light. */
const LIGHT = [
  "radial-gradient(120% 80% at 15% 10%, rgb(160 200 255 / 0.22), transparent 60%)",
  "radial-gradient(110% 90% at 50% 0%, rgb(255 255 255 / 0.16), transparent 60%)",
  "radial-gradient(120% 90% at 85% 15%, rgb(255 180 110 / 0.28), transparent 62%)",
];
// film grain: an SVG noise texture, drawn once
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")";

/**
 * The Mission's film frame: a scene picture when one could be generated, or
 * a designed set (light, colour and a motif from the learner's field) when
 * not. Slow camera drift, letterbox bars and grain give it a film feel; with
 * reduced motion it is a still frame. Captions and the moment panel sit on top.
 */
export function MissionStage({
  field,
  scene,
  audience,
  imageUrl,
  dim,
  onImageError,
  children,
}: {
  field: string;
  scene: number;
  audience: Audience;
  /** a generated picture for this scene, if any */
  imageUrl: string | null;
  /** darken the picture while a decision is on screen */
  dim: boolean;
  onImageError?: () => void;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const set = backdropOf(field);
  const Motif = MOTIF[set.motif as keyof typeof MOTIF] ?? Briefcase;
  const [loaded, setLoaded] = React.useState<string | null>(null);
  // camera moves differ per scene so cuts feel like new shots
  const drift = [
    { scale: [1.04, 1.12], x: ["0%", "-2%"], y: ["0%", "-1%"] },
    { scale: [1.12, 1.04], x: ["-2%", "1%"], y: ["-1%", "0%"] },
    { scale: [1.05, 1.14], x: ["1%", "-1%"], y: ["1%", "-1%"] },
  ][scene % 3]!;
  const camera = reduce ? {} : { animate: drift, transition: { duration: 22, ease: "linear" as const } };

  return (
    <div className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-card bg-black text-white shadow-2xl sm:aspect-[21/9]" style={{ backgroundImage: `linear-gradient(160deg, ${set.from}, ${set.to})` }}>
      <AnimatePresence initial={false}>
        <motion.div key={`set-${scene}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
          <motion.div className="absolute -inset-[6%]" {...camera}>
            <div className="absolute inset-0" style={{ backgroundImage: LIGHT[scene % 3] }} />
            <Motif aria-hidden strokeWidth={0.6} className="absolute -right-[4%] top-1/2 size-[70%] -translate-y-1/2 text-white/[0.07] blur-[1px]" />
            {audience !== "executive" && !reduce
              ? [0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute rounded-full bg-white/10 blur-2xl"
                    style={{ width: `${10 + i * 4}%`, aspectRatio: "1", left: `${8 + i * 18}%`, top: `${20 + ((i * 37) % 55)}%` }}
                    animate={{ y: ["0%", "-30%", "0%"], opacity: [0.25, 0.5, 0.25] }}
                    transition={{ duration: 9 + i * 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))
              : null}
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated per learner, served by our own route
              <img
                src={imageUrl}
                alt=""
                onLoad={() => setLoaded(imageUrl)}
                onError={onImageError}
                className={cn("absolute inset-0 size-full object-cover transition-opacity duration-1000", loaded === imageUrl ? "opacity-100" : "opacity-0")}
              />
            ) : null}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* grade, grain and letterbox */}
      <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 transition-opacity duration-700", dim ? "opacity-100" : "opacity-70")} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[6%] bg-black" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[6%] bg-black" />

      <div className="absolute inset-x-0 top-[6%] bottom-[6%] flex flex-col">{children}</div>
    </div>
  );
}
