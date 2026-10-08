import * as React from "react";
import { cn } from "cn";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  CopyMinus,
  Filter,
  Globe,
  Hash,
  Hourglass,
  MousePointerClick,
  PenLine,
  Sheet,
  Split,
  UserRoundPlus,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "@/lib/sandbox/nodes";
import "./n8n.css";

export type GlyphKey = IconKey | "manual" | "form";

const GLYPHS: Record<GlyphKey, LucideIcon> = {
  sheets: Sheet,
  schedule: Clock,
  webhook: Webhook,
  set: PenLine,
  filter: Filter,
  if: Split,
  dedupe: CopyMinus,
  hubspot: UserRoundPlus,
  slack: Hash,
  http: Globe,
  wait: Hourglass,
  noop: ArrowRight,
  manual: MousePointerClick,
  form: ClipboardList,
};

/** The icon n8n-style screens use for a node, in that node's colour. Decorative. */
export function NodeGlyph({ icon, className }: { icon: GlyphKey; className?: string }) {
  const Icon = GLYPHS[icon];
  return <Icon aria-hidden data-glyph={icon} className={cn("nx-glyph shrink-0", className)} />;
}
