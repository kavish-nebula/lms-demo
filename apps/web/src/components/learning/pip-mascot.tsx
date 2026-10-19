"use client";

import * as React from "react";
import { cn } from "cn";

export type PipReaction = "idle" | "wave" | "point" | "think" | "celebrate";

/** A code-native 3D Pip based on the Nebula KnowLab helmet-and-orbit character. */
export function PipMascot({
  className,
  happy = false,
  reaction,
}: {
  className?: string;
  happy?: boolean;
  reaction?: PipReaction;
}) {
  const id = React.useId().replace(/:/g, "");
  const mood = reaction ?? (happy ? "celebrate" : "idle");
  const shell = `${id}-pip-shell`;
  const shellShade = `${id}-pip-shell-shade`;
  const face = `${id}-pip-face`;
  const accent = `${id}-pip-accent`;
  const accentDeep = `${id}-pip-accent-deep`;
  const accentSoft = `${id}-pip-accent-soft`;
  const metal = `${id}-pip-metal`;
  const shadow = `${id}-pip-shadow`;
  const glow = `${id}-pip-glow`;

  return (
    <svg viewBox="0 0 140 154" fill="none" className={cn("pip-mascot pip-3d", className)} data-reaction={mood} aria-hidden="true">
      <defs>
        <linearGradient id={shell} x1="34" y1="24" x2="102" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8f6ff" /><stop offset=".48" stopColor="#cbc5ee" /><stop offset="1" stopColor="#877bbd" />
        </linearGradient>
        <linearGradient id={shellShade} x1="36" y1="29" x2="105" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#faf8ff" /><stop offset=".68" stopColor="#c7c0ed" /><stop offset="1" stopColor="#7d70b4" />
        </linearGradient>
        <linearGradient id={face} x1="38" y1="37" x2="100" y2="81" gradientUnits="userSpaceOnUse">
          <stop stopColor="#302852" /><stop offset=".48" stopColor="#1d1930" /><stop offset="1" stopColor="#0f0c19" />
        </linearGradient>
        <linearGradient id={accent} x1="15" y1="20" x2="120" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b7acff" /><stop offset=".45" stopColor="#8f80ff" /><stop offset="1" stopColor="#6d5cf6" />
        </linearGradient>
        <linearGradient id={accentDeep} x1="30" y1="20" x2="120" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9c8fff" /><stop offset=".5" stopColor="#6d5cf6" /><stop offset="1" stopColor="#3e2ba5" />
        </linearGradient>
        <linearGradient id={accentSoft} x1="45" y1="16" x2="122" y2="89" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9c4f5" /><stop offset="1" stopColor="#7d6cff" />
        </linearGradient>
        <linearGradient id={metal} x1="34" y1="90" x2="92" y2="145" gradientUnits="userSpaceOnUse">
          <stop stopColor="#625b82" /><stop offset="1" stopColor="#28213f" />
        </linearGradient>
        <filter id={shadow} x="-45%" y="-35%" width="190%" height="190%"><feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#0b0816" floodOpacity=".34" /></filter>
        <filter id={glow} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      <ellipse className="pip3-ground" cx="70" cy="146" rx="36" ry="5.5" fill="#6d5cf6" opacity=".2" />
      <g className="pip3-character" filter={`url(#${shadow})`}>
        <g className="pip3-arm pip3-arm-left">
          <circle cx="45" cy="101" r="9" fill={`url(#${metal})`} />
          <path d="M43 100C31 99 27 110 18 108" stroke={`url(#${shell})`} strokeWidth="15" strokeLinecap="round" />
          <path d="M31 101c-3 5-3 9 0 13" stroke={`url(#${accent})`} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="14" cy="106" r="7.5" fill={`url(#${metal})`} />
          <path d="M10 103 5 99M13 101l-1-6M16 102l3-5" stroke="#41385f" strokeWidth="3.2" strokeLinecap="round" />
        </g>
        <g className="pip3-arm pip3-arm-right">
          <circle cx="95" cy="101" r="9" fill={`url(#${metal})`} />
          <path d="M97 100c12-1 16 10 25 8" stroke={`url(#${shell})`} strokeWidth="15" strokeLinecap="round" />
          <path d="M109 101c3 5 3 9 0 13" stroke={`url(#${accentSoft})`} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="126" cy="106" r="7.5" fill={`url(#${metal})`} />
          <path d="m123 102-1-6m4 5 2-6m1 8 5-4" stroke="#41385f" strokeWidth="3.2" strokeLinecap="round" />
        </g>

        <g className="pip3-body">
          <path d="M48 99c0-12 10-21 22-21s22 9 22 21v25c0 11-9 18-22 18s-22-7-22-18V99Z" fill={`url(#${shell})`} stroke="#7d70b4" strokeWidth="1.7" />
          <path d="M52 96c5-7 12-10 18-10 7 0 14 3 18 10" stroke="white" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 121c12 8 28 9 40 0v8c-4 8-11 12-20 12s-16-4-20-12v-8Z" fill={`url(#${metal})`} opacity=".98" />
          <path d="M57 126c8 4 18 4 26 0" stroke={`url(#${accentDeep})`} strokeWidth="3" strokeLinecap="round" />
          <rect x="62" y="80" width="16" height="10" rx="5" fill={`url(#${metal})`} />

          <path d="M19 53C14 27 33 9 62 7c24-2 47 9 60 30" stroke={`url(#${accent})`} strokeWidth="6" strokeLinecap="round" />
          <path d="M24 35C49 9 93 12 119 43" stroke={`url(#${accentDeep})`} strokeWidth="5" strokeLinecap="round" />
          <path d="M77 11c25 8 42 25 45 47" stroke={`url(#${accentSoft})`} strokeWidth="5" strokeLinecap="round" />

          <rect x="17" y="19" width="106" height="76" rx="37" fill={`url(#${shellShade})`} stroke="#a59bd2" strokeWidth="2" />
          <path d="M27 32c18-18 55-20 78-5" stroke="white" strokeOpacity=".88" strokeWidth="5" strokeLinecap="round" />
          <rect x="27" y="29" width="86" height="55" rx="25" fill={`url(#${face})`} stroke="#28213f" strokeWidth="2.5" />
          <path d="M36 35c18-9 48-9 67 3" stroke="white" strokeOpacity=".2" strokeWidth="4" strokeLinecap="round" />

          <g className="pip3-ear pip3-ear-left">
            <rect x="10" y="42" width="19" height="35" rx="9.5" fill={`url(#${metal})`} stroke="#2b2346" strokeWidth="1.5" />
            <ellipse cx="19.5" cy="59.5" rx="6.5" ry="11" stroke={`url(#${accent})`} strokeWidth="3" />
            <ellipse cx="19.5" cy="59.5" rx="3" ry="6" stroke={`url(#${accentSoft})`} strokeWidth="2" />
          </g>
          <g className="pip3-ear pip3-ear-right">
            <rect x="111" y="42" width="19" height="35" rx="9.5" fill={`url(#${metal})`} stroke="#2b2346" strokeWidth="1.5" />
            <ellipse cx="120.5" cy="59.5" rx="6.5" ry="11" stroke={`url(#${accentDeep})`} strokeWidth="3" />
          </g>

          <g className="pip3-eyes" stroke="#e8e4ff" strokeWidth="5" strokeLinecap="round" filter={`url(#${glow})`}>
            {happy || mood === "wave" || mood === "celebrate" || mood === "point" ? <><path d="M41 57q8-12 16 0" /><path d="M83 57q8-12 16 0" /></> : mood === "think" ? <><path d="M41 57q8-12 16 0" /><path d="M85 54h12" /></> : <><path d="M48 50v10" /><path d="M92 50v10" /></>}
          </g>
          <path className="pip3-mouth" d={mood === "think" ? "M66 70q4-2 8 0" : "M64 68q6 6 12 0"} stroke="#e8e4ff" strokeWidth="3.5" strokeLinecap="round" filter={`url(#${glow})`} />
        </g>

        <g className="pip3-leg pip3-leg-left">
          <circle cx="57" cy="130" r="7" fill={`url(#${metal})`} />
          <path d="M57 132 52 143" stroke={`url(#${shell})`} strokeWidth="13" strokeLinecap="round" />
          <path d="M43 145c1-6 5-9 12-9h5v10H43Z" fill={`url(#${metal})`} stroke="#2b2346" strokeWidth="1.5" />
          <path d="M49 138c3 2 7 3 10 2" stroke={`url(#${accentDeep})`} strokeWidth="3" />
        </g>
        <g className="pip3-leg pip3-leg-right">
          <circle cx="83" cy="130" r="7" fill={`url(#${metal})`} />
          <path d="m83 132 5 11" stroke={`url(#${shell})`} strokeWidth="13" strokeLinecap="round" />
          <path d="M80 136h5c7 0 11 3 12 9H80v-9Z" fill={`url(#${metal})`} stroke="#2b2346" strokeWidth="1.5" />
          <path d="M81 140c4 1 8 0 11-2" stroke={`url(#${accentSoft})`} strokeWidth="3" />
        </g>
      </g>

      {mood === "celebrate" ? <g className="pip3-confetti"><path d="m11 36 7 3" stroke="#c9c4f5" strokeWidth="3" strokeLinecap="round" /><path d="m122 24 4-7" stroke="#b7acff" strokeWidth="3" strokeLinecap="round" /><path d="m119 98 8 1" stroke="#9c8fff" strokeWidth="3" strokeLinecap="round" /><circle cx="16" cy="94" r="3" fill="#b7acff" /></g> : null}
    </svg>
  );
}
