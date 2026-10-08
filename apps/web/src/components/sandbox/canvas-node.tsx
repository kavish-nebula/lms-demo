"use client";

import * as React from "react";
import { cn } from "cn";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleCheck, RefreshCw, TriangleAlert, Zap } from "lucide-react";
import { NodeGlyph } from "@/components/n8n/node-glyph";
import { NODES, outputsOf } from "@/lib/sandbox/nodes";
import type { NodeRun, SNode } from "@/lib/sandbox/types";

export type CanvasNodeData = {
  node: SNode;
  /** this node's run in the selected execution */
  run?: NodeRun;
  /** labels for the output handles, already translated */
  outputLabels: Record<string, string>;
  onOpen: (id: string) => void;
};

export type CanvasNode = Node<CanvasNodeData, "n8n">;

/**
 * A node on the sandbox canvas, drawn like n8n's: a rounded tile with the
 * node's icon and its name underneath. Triggers have a rounded left side and
 * no input. After a run the tile shows success or the error, and each
 * output shows how many items left through it.
 */
export function CanvasNodeView({ id, data, selected }: NodeProps<CanvasNode>) {
  const { node, run } = data;
  const def = NODES[node.type];
  const outs = outputsOf(node);
  const failed = run?.status === "error" || (!!run?.error && node.settings.onError !== "stop");

  return (
    <div className="flex w-28 flex-col items-center gap-2" onDoubleClick={() => data.onOpen(id)}>
      <div
        className={cn(
          "relative flex size-[76px] items-center justify-center border-2 bg-panel shadow-sm transition-colors",
          def.trigger ? "rounded-l-[38px] rounded-r-xl" : "rounded-xl",
          selected ? "border-brand ring-4 ring-brand/25" : run ? (failed ? "border-err" : "border-ok") : "border-line hover:border-ink-faint",
        )}
      >
        {!def.trigger ? <Handle type="target" position={Position.Left} className="sbx-handle" /> : null}
        <NodeGlyph icon={def.icon} className="size-8" />
        {def.trigger ? <Zap aria-hidden className="absolute -top-2 -left-2 size-5 rounded-full bg-panel p-0.5 text-warn" /> : null}
        {node.settings.retryOnFail ? <RefreshCw aria-hidden className="absolute top-1 right-1 size-3 text-ink-faint" /> : null}
        {run ? (
          failed ? (
            <TriangleAlert aria-hidden className="absolute -right-2 -bottom-2 size-5 rounded-full bg-panel p-0.5 text-err" />
          ) : (
            <CircleCheck aria-hidden className="absolute -right-2 -bottom-2 size-5 rounded-full bg-panel text-ok" />
          )
        ) : null}
        {outs.map((h, i) => (
          <Handle
            key={h}
            id={h}
            type="source"
            position={Position.Right}
            className={cn("sbx-handle", h === "error" && "sbx-handle-error")}
            style={{ top: `${((i + 1) * 100) / (outs.length + 1)}%` }}
          >
            {outs.length > 1 ? (
              <span className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-medium", h === "error" ? "text-err" : "text-ink-faint")}>
                {data.outputLabels[h]}
              </span>
            ) : null}
          </Handle>
        ))}
      </div>
      <div className="w-full text-center text-xs leading-tight font-medium break-words">{node.name}</div>
    </div>
  );
}
