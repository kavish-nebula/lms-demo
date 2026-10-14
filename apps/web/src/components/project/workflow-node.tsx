"use client";
import { Handle,Position,type NodeProps,type Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { branchesFor,type WorkflowKind } from "@/lib/workflow-project";

export type DiagramNode = Node<{ label: string; kind: WorkflowKind },"workflow">;
export function WorkflowNode({ data,selected }: NodeProps<DiagramNode>) {
  const t = useTranslations("workflow");
  const branches = branchesFor(data.kind);
  return <div className={`w-52 rounded-xl border bg-panel p-3 shadow-sm ${selected ? "border-brand ring-2 ring-ring/40" : "border-line"}`}>
    {data.kind !== "receive" ? <Handle type="target" position={Position.Left} aria-label={t("inputHandle")} /> : null}
    <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-brand-ink">{t(data.kind)}</div>
    <div className="text-sm font-semibold break-words text-ink">{data.label}</div>
    {branches.map((branch,i) => <div key={branch} className="mt-2 text-right text-xs text-ink-muted">{t(branch)}<Handle type="source" id={branch} position={Position.Right} style={{ top: `${(i + 1) * 100 / (branches.length + 1)}%` }} aria-label={t(branch)} /></div>)}
  </div>;
}
