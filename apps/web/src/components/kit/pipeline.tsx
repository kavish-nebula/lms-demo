"use client";

import * as React from "react";
import { cn } from "cn";
import { motion } from "motion/react";
import { Check, Clock, Filter, Globe, Send, Table2, X, Zap, type LucideIcon } from "lucide-react";
import type { Pipeline, PipelineNode } from "@/data/types";

const NODE_W = 184;
const NODE_H = 68;
const PAD = 16;

const KIND: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  trigger: { icon: Zap, tone: "text-stage-hook border-stage-hook-line bg-stage-hook-soft", label: "Trigger" },
  data: { icon: Table2, tone: "text-stage-worked border-stage-worked-line bg-stage-worked-soft", label: "Data" },
  logic: { icon: Filter, tone: "text-stage-guided border-stage-guided-line bg-stage-guided-soft", label: "Logic" },
  action: { icon: Send, tone: "text-brand-ink border-brand-line bg-brand-soft", label: "Action" },
  wait: { icon: Clock, tone: "text-ink-muted border-line bg-panel-2", label: "Wait" },
  http: { icon: Globe, tone: "text-info border-info-line bg-info-soft", label: "HTTP" },
};

export function nodeKind(kind: string) {
  return KIND[kind] ?? KIND.wait!;
}

/**
 * n8n-style pipeline (the prototype's React Flow canvas, simplified to a
 * static, accessible diagram). Node and edge states animate between frames:
 * idle, running, ok, error. Scales down to fit narrow containers.
 */
export function PipelineDiagram({
  pipeline,
  className,
  label,
  onNodeClick,
  selectedId,
}: {
  pipeline: Pipeline;
  className?: string;
  /** accessible summary prefix, e.g. "Lead alerts" */
  label?: string;
  onNodeClick?: (id: string) => void;
  selectedId?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const nodes = pipeline.nodes;
  const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 0;
  const naturalW = Math.max(...nodes.map((n) => n.x - minX), 0) + NODE_W + PAD * 2;
  const naturalH = Math.max(...nodes.map((n) => n.y - minY), 0) + NODE_H + PAD * 2;
  const scale = width ? Math.min(1, width / naturalW) : 1;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pos = (n: PipelineNode) => ({ x: n.x - minX + PAD, y: n.y - minY + PAD });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const summary = `${label ? `${label}: ` : ""}${nodes.map((n) => `${n.label}${n.state !== "idle" ? ` (${n.state})` : ""}`).join(" → ")}`;

  if (!nodes.length) return null;

  return (
    <div ref={ref} className={cn("w-full", className)} data-slot="pipeline">
      <div style={{ height: naturalH * scale }} className="relative">
        <div
          role="img"
          aria-label={summary}
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: naturalW, height: naturalH, transform: `scale(${scale})` }}
        >
          <svg aria-hidden className="absolute inset-0 overflow-visible" width={naturalW} height={naturalH}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--faint)" />
              </marker>
            </defs>
            {pipeline.edges.map((e) => {
              const a = byId.get(e.source);
              const b = byId.get(e.target);
              if (!a || !b) return null;
              const pa = pos(a);
              const pb = pos(b);
              const x1 = pa.x + NODE_W;
              const y1 = pa.y + NODE_H / 2;
              const x2 = pb.x;
              const y2 = pb.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              return (
                <path
                  key={e.id}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 4} ${y2}`}
                  fill="none"
                  strokeWidth={2}
                  markerEnd="url(#arrow)"
                  className={cn(
                    "transition-[stroke] duration-(--dur-2)",
                    e.state === "error" ? "stroke-err" : e.state === "ok" ? "stroke-ok" : "stroke-ink-faint/60",
                  )}
                  strokeDasharray={e.state === "running" ? "6 6" : undefined}
                />
              );
            })}
          </svg>
          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              x={pos(n).x}
              y={pos(n).y}
              selected={selectedId === n.id}
              onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  x,
  y,
  selected,
  onClick,
}: {
  node: PipelineNode;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const k = nodeKind(node.kind);
  const Icon = k.icon;
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-state={node.state}
      aria-pressed={onClick ? selected : undefined}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: node.state === "running" ? 1.03 : 1,
        x: node.state === "error" ? [0, -4, 4, -2, 0] : 0,
      }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "absolute flex items-center gap-2.5 rounded-xl border bg-panel px-3 text-left shadow-sm outline-none",
        "data-[state=running]:border-brand data-[state=running]:shadow-[0_0_0_4px_var(--accent-soft)]",
        "data-[state=ok]:border-ok-line data-[state=error]:border-err data-[state=error]:shadow-[0_0_0_4px_var(--err-soft)]",
        onClick && "cursor-pointer hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring/60",
        selected && "border-brand ring-2 ring-brand-line",
      )}
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", k.tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{node.label}</span>
        <span className="block truncate font-mono text-[11px] text-ink-faint">{node.note ?? node.sub}</span>
      </span>
      {node.state === "ok" ? (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ok text-on-ok">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      ) : node.state === "error" ? (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-err text-white">
          <X className="size-3" strokeWidth={3} aria-hidden />
        </span>
      ) : node.state === "running" ? (
        <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-brand motion-safe:animate-ping" aria-hidden />
      ) : null}
    </Comp>
  );
}
