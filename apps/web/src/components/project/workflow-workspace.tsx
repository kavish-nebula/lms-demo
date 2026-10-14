"use client";
import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { ReactFlow,Background,Controls,MarkerType,applyNodeChanges,type Connection,type Edge,type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft,Check,Download,GitBranch,Save,Undo2,X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useEnrollment } from "@/lib/enrollment";
import { useLocalJson,writeLocal } from "@/lib/local-store";
import { branchesFor,checkWorkflow,WORKFLOW_KINDS,type Workflow,type WorkflowReport,type WorkflowView } from "@/lib/workflow-project";
import type { Course } from "@/data/types";
import { WorkflowNode,type DiagramNode } from "./workflow-node";
import "./workflow-workspace.css";

const nodeTypes = { workflow: WorkflowNode };
type Draft = { diagram: Workflow; revision: number; dirty: boolean };
const selectClass = "min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand";

export function WorkflowWorkspace({ course }: { course: Course }) {
  const t = useTranslations("workflow");
  const { enrolled,ready } = useEnrollment(course.course_id);
  const endpoint = `/api/v1/enrollments/${course.course_id}/workflow-project`;
  const { data,error: loadError,isLoading,mutate } = useSWR<WorkflowView>(enrolled ? endpoint : null,(url: string) => api(url),{ revalidateOnFocus: false });
  const draftKey = `lms-workflow:v1:${course.course_id}`;
  const local = useLocalJson<Draft | null>(draftKey,null);
  const [diagram,setDiagram] = React.useState<Workflow | null>(null);
  const [revision,setRevision] = React.useState(0);
  const [dirty,setDirty] = React.useState(false);
  const [report,setReport] = React.useState<WorkflowReport | null>(null);
  const [selected,setSelected] = React.useState("");
  const [source,setSource] = React.useState(""); const [target,setTarget] = React.useState(""); const [branch,setBranch] = React.useState("next");
  const [busy,setBusy] = React.useState(false); const [error,setError] = React.useState("");
  const [history,setHistory] = React.useState<Workflow[]>([]);
  const [reloadOpen,setReloadOpen] = React.useState(false);
  const dragStart = React.useRef<Workflow | null>(null);
  if (!diagram && ready && !isLoading) {
    const start: Workflow = { version: 1,nodes: WORKFLOW_KINDS.map((kind,i) => ({ id: crypto.randomUUID(),kind,label: t(`${kind}Label`),notes: "",position: { x: 80 + (i % 3) * 280,y: 70 + Math.floor(i / 3) * 180 } })),edges: [] };
    const initial = local?.dirty ? local : { diagram: data?.diagram ?? local?.diagram ?? start,revision: data?.revision ?? 0,dirty: !data?.diagram };
    setDiagram(initial.diagram); setRevision(initial.revision); setDirty(initial.dirty); setReport(initial.dirty ? null : data?.report ?? null);
  }
  function change(next: Workflow,remember = true) {
    if (!diagram) return;
    if (remember) setHistory((old) => [...old.slice(-29),diagram]);
    setDiagram(next); setDirty(true); setReport(null); setError("");
    const draft: Draft = { diagram: next,revision,dirty: true }; const encoded = JSON.stringify(draft);
    writeLocal(draftKey,encoded);
    try { if (localStorage.getItem(draftKey) !== encoded) setError(t("storageFailed")); } catch { setError(t("storageFailed")); }
  }
  async function save(check = false) {
    if (!diagram || busy) return; setBusy(true); setError("");
    try {
      if (!enrolled) { setReport(check ? checkWorkflow(diagram) : null); return; }
      const result = await api<WorkflowView>(check ? `${endpoint}/check` : endpoint,{ method: check ? "POST" : "PUT",body: { diagram,revision } });
      await mutate(result,{ revalidate: false }); setRevision(result.revision); setDirty(false); setReport(result.report);
      writeLocal(draftKey,JSON.stringify({ diagram,revision: result.revision,dirty: false }));
    } catch (e) { setError(e instanceof Error ? e.message : t("saveFailed")); } finally { setBusy(false); }
  }
  function connect(from: string,to: string,which: string) {
    if (!diagram || !from || !to) return;
    if (from === to || diagram.edges.some((e) => e.source === from && e.branch === which)) { setError(t("connectionInvalid")); return; }
    change({ ...diagram,edges: [...diagram.edges,{ id: crypto.randomUUID(),source: from,target: to,branch: which as Workflow["edges"][number]["branch"] }] });
  }
  function dragConnect(connection: Connection) {
    connect(connection.source,connection.target,connection.sourceHandle ?? "next");
  }
  function moveNodes(changes: NodeChange<DiagramNode>[]) {
    const selection = changes.find((c) => c.type === "select" && c.selected);
    if (selection?.type === "select") setSelected(selection.id);
    const moved = changes.filter((c) => c.type === "position");
    if (!moved.length || busy || !diagram) return;
    const dragging = moved.some((c) => c.type === "position" && c.dragging);
    if (dragging && !dragStart.current) dragStart.current = diagram;
    const updated = applyNodeChanges(moved,nodes);
    change({ ...diagram,nodes: diagram.nodes.map((n) => ({ ...n,position: updated.find((x) => x.id === n.id)?.position ?? n.position })) },!dragging && !dragStart.current);
    if (!dragging && dragStart.current) {
      const start = dragStart.current; setHistory((old) => [...old.slice(-29),start]); dragStart.current = null;
    }
  }
  async function reloadServer() {
    setBusy(true); setError("");
    try {
      const result = await api<WorkflowView>(endpoint);
      if (result.diagram) {
        setDiagram(result.diagram); setRevision(result.revision); setDirty(false); setReport(result.report); setHistory([]); setSelected("");setSource("");setTarget("");
        writeLocal(draftKey,JSON.stringify({ diagram: result.diagram,revision: result.revision,dirty: false }));
      } else { setRevision(0); setDirty(true); }
      await mutate(result,{ revalidate: false }); setReloadOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : t("loadFailed")); } finally { setBusy(false); }
  }
  function exportDiagram() {
    if (!diagram) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(diagram,null,2)],{ type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "scout-workflow.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  const nodes: DiagramNode[] = diagram?.nodes.map((n) => ({ id: n.id,type: "workflow",position: n.position,data: { label: n.label,kind: n.kind },selected: selected === n.id,ariaLabel: `${t(n.kind)}: ${n.label}` })) ?? [];
  const edges: Edge[] = diagram?.edges.map((e) => ({ ...e,sourceHandle: e.branch,label: t(e.branch),type: "smoothstep",markerEnd: { type: MarkerType.ArrowClosed } })) ?? [];
  const active = diagram?.nodes.find((n) => n.id === selected);
  const sourceNode = diagram?.nodes.find((n) => n.id === source);
  const choices = sourceNode ? branchesFor(sourceNode.kind) : [];
  if (!diagram) return <main className="page-pad py-8" aria-busy>{t("loading")}</main>;
  return <div className="flex min-h-dvh flex-col bg-canvas text-ink">
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-3">
      <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={t("back")}><Link href={`/learn/courses/${course.course_id}/finale/capstone`}><ArrowLeft /></Link></Button>
      <div className="min-w-0 flex-1"><p className="text-xs text-ink-muted">{course.title}</p><h1 className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" aria-hidden />{t("title")}</h1></div>
      <span role="status" className="text-xs text-ink-muted">{busy ? t("saving") : !enrolled ? t("localOnly") : dirty ? t("draft") : t("saved")}</span>
      <Button asChild variant="outline" className="min-h-11"><Link href={`/learn/courses/${course.course_id}/finale/capstone/workspace`}>{t("python")}</Link></Button>
      <Button className="min-h-11" variant="outline" disabled={busy || !enrolled} onClick={() => void save()}><Save aria-hidden />{t("save")}</Button>
      <Button className="min-h-11" variant="brand" disabled={busy} onClick={() => void save(true)}>{t("check")}</Button>
    </header>
    <div className="border-b border-line px-4 py-3 text-sm"><p>{t("brief")}</p><p className="mt-1 text-ink-muted">{t("boundary")}</p>{!enrolled ? <Link className="inline-flex min-h-11 items-center text-brand-ink underline" href={`/learn/courses/${course.course_id}/enroll`}>{t("enroll")}</Link> : null}{error || loadError ? <><p role="alert" className="mt-2 text-err">{error || t("loadFailed")}</p>{enrolled ? <Button className="mt-2 min-h-11" variant="outline" onClick={() => setReloadOpen(true)}>{t("reloadServer")}</Button> : null}</> : null}</div>
    <Dialog open={reloadOpen} onOpenChange={setReloadOpen}><DialogContent><DialogHeader><DialogTitle>{t("reloadServer")}</DialogTitle><DialogDescription>{t("reloadHelp")}</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={exportDiagram}>{t("export")}</Button><Button className="min-h-11" disabled={busy} onClick={() => void reloadServer()}>{t("confirmReload")}</Button></div></DialogContent></Dialog>
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
      <aside className="flex flex-col gap-4 border-b border-line p-4 lg:border-r lg:border-b-0" aria-label={t("steps")}>
        <h2 className="font-semibold">{t("addStep")}</h2><div className="grid grid-cols-2 gap-2 lg:grid-cols-1">{WORKFLOW_KINDS.map((kind) => <Button key={kind} variant="outline" className="min-h-11 justify-start" disabled={busy || diagram.nodes.length >= 40} onClick={() => { const id = crypto.randomUUID(); change({ ...diagram,nodes: [...diagram.nodes,{ id,kind,label: t(`${kind}Label`),notes: "",position: { x: 80 + (diagram.nodes.length % 3) * 280,y: 70 + Math.floor(diagram.nodes.length / 3) * 180 } }] }); setSelected(id); }}>{t(kind)}</Button>)}</div>
        <h2 className="font-semibold">{t("connect")}</h2>
        <label className="flex flex-col gap-1 text-sm">{t("from")}<select className={selectClass} value={source} onChange={(e) => { setSource(e.target.value); const node = diagram.nodes.find((n) => n.id === e.target.value); setBranch(node ? branchesFor(node.kind)[0] ?? "next" : "next"); }}><option value="">{t("choose")}</option>{diagram.nodes.filter((n) => branchesFor(n.kind).length).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("branch")}<select className={selectClass} value={choices.includes(branch as never) ? branch : ""} onChange={(e) => setBranch(e.target.value)}><option value="" disabled>{t("choose")}</option>{choices.map((b) => <option key={b} value={b}>{t(b)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("to")}<select className={selectClass} value={target} onChange={(e) => setTarget(e.target.value)}><option value="">{t("choose")}</option>{diagram.nodes.filter((n) => n.kind !== "receive" && n.id !== source).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
        <Button className="min-h-11" disabled={busy || !source || !target || !choices.length || diagram.edges.length >= 80} onClick={() => connect(source,target,branch)}>{t("addConnection")}</Button>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={!history.length || busy} onClick={() => { const previous = history[history.length-1]; setHistory((old) => old.slice(0,-1)); change(previous,false); }}><Undo2 aria-hidden />{t("undo")}</Button><Button variant="outline" className="min-h-11" onClick={exportDiagram}><Download aria-hidden />{t("export")}</Button></div>
      </aside>
      <section className="workflow-canvas order-first h-[65dvh] min-h-96 lg:order-none lg:h-[calc(100dvh-10rem)] lg:min-h-[650px]" aria-label={t("canvas")}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_e,n) => setSelected(n.id)} onConnect={dragConnect} nodesDraggable={!busy} nodesConnectable={!busy} deleteKeyCode={null} onNodesChange={moveNodes} fitView minZoom={0.25} maxZoom={1.5}><Background /><Controls showInteractive={false} /></ReactFlow>
      </section>
      <aside className="flex flex-col gap-5 border-t border-line p-4 lg:border-t-0 lg:border-l" aria-label={t("details")}>
        <h2 className="font-semibold">{t("details")}</h2>
        <label className="flex flex-col gap-1 text-sm">{t("selectStep")}<select className={selectClass} value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">{t("choose")}</option>{diagram.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
        {active ? <div className="flex flex-col gap-3"><Label htmlFor="step-label">{t("label")}</Label><Input id="step-label" className="min-h-11" maxLength={100} disabled={busy} value={active.label} onChange={(e) => change({ ...diagram,nodes: diagram.nodes.map((n) => n.id === active.id ? { ...n,label: e.target.value } : n) })} /><Label htmlFor="step-notes">{t("notes")}</Label><Textarea id="step-notes" maxLength={500} disabled={busy} value={active.notes} onChange={(e) => change({ ...diagram,nodes: diagram.nodes.map((n) => n.id === active.id ? { ...n,notes: e.target.value } : n) })} /><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => { change({ ...diagram,nodes: diagram.nodes.filter((n) => n.id !== active.id),edges: diagram.edges.filter((e) => e.source !== active.id && e.target !== active.id) }); setSelected(""); }}>{t("removeStep")}</Button></div> : <p className="text-sm text-ink-muted">{t("selectHelp")}</p>}
        <section><h2 className="mb-2 font-semibold">{t("connections")}</h2>{!diagram.edges.length ? <p className="text-sm text-ink-muted">{t("noConnections")}</p> : <ul className="flex flex-col gap-2">{diagram.edges.map((e) => <li key={e.id} className="flex items-center gap-2 rounded-lg border border-line p-2 text-xs"><span className="min-w-0 flex-1 break-words">{diagram.nodes.find((n) => n.id === e.source)?.label} → {diagram.nodes.find((n) => n.id === e.target)?.label}<span className="block text-ink-muted">{t(e.branch)}</span></span><Button size="icon" variant="ghost" className="min-h-11 min-w-11" disabled={busy} aria-label={t("removeConnection",{ branch: t(e.branch) })} onClick={() => change({ ...diagram,edges: diagram.edges.filter((x) => x.id !== e.id) })}><X /></Button></li>)}</ul>}</section>
        <section aria-live="polite"><h2 className="mb-2 font-semibold">{t("checks")}</h2>{report ? <><p className={`mb-3 text-sm font-medium ${report.passed ? "text-ok" : "text-warn"}`}>{t(report.passed ? "passed" : "notPassed")}</p><ul className="flex flex-col gap-3">{report.checks.map((c) => <li key={c.id} className="flex gap-2 text-sm">{c.passed ? <Check className="size-4 shrink-0 text-ok" aria-hidden /> : <X className="size-4 shrink-0 text-warn" aria-hidden />}<div>{t(`check_${c.id}`)}{!c.passed ? <p className="mt-1 text-xs text-ink-muted">{t(`hint_${c.id}`)}</p> : null}</div></li>)}</ul><h3 className="mt-4 mb-2 font-medium">{t("traces")}</h3>{report.traces.map((trace) => <div className="mb-3 text-xs" key={trace.scenario}><p className="font-medium">{t(`scenario_${trace.scenario}`)} · {t(trace.passed ? "tracePassed" : "traceFailed")}</p><p className="mt-1 text-ink-muted">{trace.steps.map((id) => diagram.nodes.find((n) => n.id === id)?.label).join(" → ")}</p></div>)}</> : <p className="text-sm text-ink-muted">{t("checkHelp")}</p>}</section>
      </aside>
    </main>
  </div>;
}
