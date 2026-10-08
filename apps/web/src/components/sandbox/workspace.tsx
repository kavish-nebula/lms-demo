"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import "./sandbox.css";
import { ChevronLeft, ClipboardCheck, Info, PanelRight, Play, Plus, Search } from "lucide-react";
import { NodeGlyph } from "@/components/n8n/node-glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CanvasNodeView, type CanvasNode } from "@/components/sandbox/canvas-node";
import { NodeDetails } from "@/components/sandbox/ndv";
import { BriefPanel, CheckPanel, RunsPanel } from "@/components/sandbox/panels";
import { gradeCapstone, type CapstoneReport } from "@/data/mock-capstone-grader";
import { blankWorkflow, persistReport, persistWorkflow, readDraft, resetDraft } from "@/lib/sandbox/draft";
import { createNode, NODES, PALETTE_GROUPS } from "@/lib/sandbox/nodes";
import { edgeCount, simulate } from "@/lib/sandbox/run";
import { useFinale } from "@/lib/finale";
import { useHydrated } from "@/lib/local-store";
import type { CapstoneBlock } from "@/data/types";
import type { Execution, Handle, NodeType, SNode, Workflow, World } from "@/lib/sandbox/types";

type Props = { courseId: string; block: CapstoneBlock; briefHref: string };

const nodeTypes = { n8n: CanvasNodeView };
const DRAG_TYPE = "application/x-lms-node";

/**
 * The capstone sandbox: an n8n-style editor where the learner builds the
 * launch pipeline, runs it on sample sign-ups, and checks it against the
 * hidden launch-day tests. Work saves in the browser as it changes.
 */
export function CapstoneWorkspace(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-dvh animate-pulse bg-panel/40" aria-busy />;
  const draft = readDraft(props.courseId);
  return (
    <ReactFlowProvider>
      <Editor {...props} initial={draft?.workflow ?? blankWorkflow()} initialReport={draft?.report} initialChecks={draft?.checks ?? 0} />
    </ReactFlowProvider>
  );
}

const toCanvas = (n: SNode, selected = false): CanvasNode => ({ id: n.id, type: "n8n", position: n.position, selected, data: { node: n, outputLabels: {}, onOpen: () => {} } });
const toEdge = (e: Workflow["edges"][number]): Edge => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target });
/** what the runner cares about: positions and selection don't make a run stale */
const shape = (wf: Workflow) => JSON.stringify({ n: wf.name, nodes: wf.nodes.map((n) => ({ ...n, position: null })), edges: wf.edges });

function Editor({ courseId, block, briefHref, initial, initialReport, initialChecks }: Props & { initial: Workflow; initialReport?: CapstoneReport; initialChecks: number }) {
  const t = useTranslations("sandbox");
  const flow = useReactFlow();
  const { markDone, state: finale } = useFinale(courseId);
  const [name, setName] = React.useState(initial.name);
  const [nodes, setNodes] = React.useState<CanvasNode[]>(() => initial.nodes.map((n) => toCanvas(n)));
  const [edges, setEdges] = React.useState<Edge[]>(() => initial.edges.map(toEdge));
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [run, setRun] = React.useState<{ executions: Execution[]; world: World; shape: string } | null>(null);
  const [selectedRun, setSelectedRun] = React.useState<number | null>(null);
  const [report, setReport] = React.useState<CapstoneReport | undefined>(initialReport);
  const [checks, setChecks] = React.useState(initialChecks);
  const [tab, setTab] = React.useState<"brief" | "runs" | "check">(initialReport ? "check" : "brief");
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const workflow: Workflow = React.useMemo(
    () => ({
      name,
      nodes: nodes.map((n) => ({ ...n.data.node, position: n.position })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: (e.sourceHandle ?? "main") as Handle, target: e.target })),
    }),
    [name, nodes, edges],
  );

  // autosave, a moment after the last change
  React.useEffect(() => {
    const id = window.setTimeout(() => persistWorkflow(courseId, workflow), 400);
    return () => window.clearTimeout(id);
  }, [courseId, workflow]);

  const exec = run?.executions.find((e) => e.n === selectedRun) ?? null;
  const stale = !!run && run.shape !== shape(workflow);
  const runLabel = React.useCallback(
    (e: Execution) => t("runLabel", { n: e.n, name: String(e.event.row["Full name"] ?? "").trim() || t("noName") }),
    [t],
  );
  const outputLabels = React.useMemo(() => ({ main: "", true: t("branch_true"), false: t("branch_false"), error: t("branch_error") }), [t]);

  const displayNodes = React.useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, run: exec?.runs[n.id], outputLabels, onOpen: setOpenId } })),
    [nodes, exec, outputLabels],
  );
  const displayEdges = React.useMemo(
    () =>
      edges.map((e) => {
        const count = edgeCount(exec, e.source, (e.sourceHandle ?? "main") as Handle);
        const err = e.sourceHandle === "error";
        return {
          ...e,
          className: cn(err && "sbx-edge-error", count ? "sbx-edge-live" : count === 0 && "sbx-edge-idle"),
          label: count ? t("itemCount", { count }) : undefined,
        };
      }),
    [edges, exec, t],
  );

  const onNodesChange = React.useCallback((changes: NodeChange<CanvasNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);
  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)), []);
  const onConnect = React.useCallback(
    (c: Connection) =>
      setEdges((es) =>
        addEdge({ ...c, id: `e-${c.source}-${c.sourceHandle ?? "main"}-${c.target}`, sourceHandle: c.sourceHandle ?? "main" }, es),
      ),
    [],
  );
  const onNodesDelete = React.useCallback((deleted: CanvasNode[]) => {
    if (deleted.some((d) => d.id === openId)) setOpenId(null);
  }, [openId]);

  const addNode = React.useCallback(
    (type: NodeType, at?: { x: number; y: number }) => {
      const taken = nodes.map((n) => n.data.node.name);
      const selected = nodes.find((n) => n.selected);
      const rightmost = [...nodes].sort((a, b) => b.position.x - a.position.x)[0];
      const anchor = selected ?? rightmost;
      const pos = at ?? (anchor ? { x: anchor.position.x + 200, y: anchor.position.y } : { x: 80, y: 160 });
      const node = createNode(type, pos, taken);
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), toCanvas(node, true)]);
      // like n8n: adding while a node is selected connects it to that node's first output
      if (selected && !at && !NODES[type].trigger) {
        const handle: Handle = selected.data.node.type === "if" ? "true" : "main";
        setEdges((es) => [...es, { id: `e-${selected.id}-${handle}-${node.id}`, source: selected.id, sourceHandle: handle, target: node.id }]);
      }
      setPaletteOpen(false);
      setOpenId(node.id);
    },
    [nodes],
  );

  const updateNode = (next: SNode) => setNodes((ns) => ns.map((n) => (n.id === next.id ? { ...n, data: { ...n.data, node: next } } : n)));

  /** n8n updates $('Old name') references when a node is renamed. */
  const renameNode = (id: string, to: string) => {
    const from = nodes.find((n) => n.id === id)?.data.node.name;
    if (!from) return;
    const taken = nodes.filter((n) => n.id !== id).map((n) => n.data.node.name);
    if (taken.includes(to)) {
      toast.error(t("nameTaken", { name: to }));
      return;
    }
    const swap = (v: unknown): unknown =>
      typeof v === "string" ? v.split(`$('${from}')`).join(`$('${to}')`).split(`$("${from}")`).join(`$("${to}")`) : Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, swap(y)])) : swap(x))) : v;
    setNodes((ns) =>
      ns.map((n) => {
        const params = Object.fromEntries(Object.entries(n.data.node.params).map(([k, v]) => [k, swap(v)])) as SNode["params"];
        return { ...n, data: { ...n.data, node: { ...n.data.node, params, name: n.id === id ? to : n.data.node.name } } };
      }),
    );
  };

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setOpenId(null);
  };

  const execute = () => {
    const events = block.sandbox.sample.map((s) => ({ row: s.row, fault: s.fault }));
    const res = simulate(workflow, events);
    setRun({ ...res, shape: shape(workflow) });
    const first = res.executions.find((e) => e.status === "error") ?? res.executions[0];
    setSelectedRun(first?.n ?? null);
    setTab("runs");
    const failed = res.executions.filter((e) => e.status === "error").length;
    const skipped = res.executions.filter((e) => e.status === "skipped").length;
    if (skipped === res.executions.length) toast.warning(t("toastSkipped"));
    else if (failed) toast.warning(t("toastFailed", { total: res.executions.length, failed }));
    else toast.success(t("toastOk", { total: res.executions.length }));
  };

  const check = () => {
    const r = gradeCapstone(workflow);
    persistReport(courseId, workflow, r);
    setReport(r);
    setChecks((c) => c + 1);
    setTab("check");
    setPanelOpen(true);
    if (r.accepted) {
      if (!finale.done.includes("capstone")) markDone("capstone", { capstoneAt: new Date().toISOString() });
      toast.success(t("accepted"));
    } else toast(t("score", { passed: r.passed, total: r.total }));
  };

  const reset = () => {
    resetDraft(courseId);
    const blank = blankWorkflow();
    setName(blank.name);
    setNodes([]);
    setEdges([]);
    setRun(null);
    setSelectedRun(null);
    setReport(undefined);
    setChecks(0);
    setTab("brief");
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DRAG_TYPE) as NodeType;
    if (!type || !NODES[type]) return;
    e.preventDefault();
    addNode(type, flow.screenToFlowPosition({ x: e.clientX - 38, y: e.clientY - 38 }));
  };

  const openNode = workflow.nodes.find((n) => n.id === openId) ?? null;
  const notes = block.sandbox.sample.map((s) => s.note);

  const panels = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)]">
        <TabsTrigger value="brief">{t("tabBrief")}</TabsTrigger>
        <TabsTrigger value="runs">{t("tabRuns")}</TabsTrigger>
        <TabsTrigger value="check">{t("tabCheck")}</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="brief">
          <BriefPanel block={block} report={report} onReset={reset} />
        </TabsContent>
        <TabsContent value="runs">
          <RunsPanel
            executions={run?.executions ?? []}
            world={run?.world ?? null}
            nodes={workflow.nodes}
            selectedRun={selectedRun}
            stale={stale}
            runLabel={runLabel}
            notes={notes}
            onSelect={setSelectedRun}
            onExecute={execute}
          />
        </TabsContent>
        <TabsContent value="check">
          <CheckPanel block={block} report={report} checks={checks} resultsHref={briefHref} onCheck={check} />
        </TabsContent>
      </div>
    </Tabs>
  );

  const palette = <Palette onAdd={(type) => addNode(type)} />;

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/70 px-3 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link href={briefHref}>
            <ChevronLeft data-icon="inline-start" />
            {t("backToBrief")}
          </Link>
        </Button>
        <Input
          aria-label={t("workflowName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-72 max-w-[60vw] border-transparent bg-transparent font-semibold hover:border-line"
        />
        <span className="hidden text-xs text-ink-faint md:inline">{t("savedLocally")}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPaletteOpen(true)}>
            <Plus data-icon="inline-start" />
            {t("nodes")}
          </Button>
          <Button variant="brand" onClick={execute}>
            <Play data-icon="inline-start" />
            {t("executeWorkflow")}
          </Button>
          <Button variant="outline" onClick={check}>
            <ClipboardCheck data-icon="inline-start" />
            {t("checkProject")}
          </Button>
          <Button variant="ghost" size="icon" className="xl:hidden" aria-label={t("openPanel")} onClick={() => setPanelOpen(true)}>
            <PanelRight />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label={t("nodes")} className="hidden w-64 shrink-0 flex-col border-r border-line bg-panel/50 lg:flex">
          {palette}
        </aside>

        <main className="relative min-w-0 flex-1" onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()} onDrop={onDrop}>
          <ReactFlow<CanvasNode>
            className="sbx-flow"
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            isValidConnection={(c) => c.source !== c.target}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView={nodes.length > 0}
            fitViewOptions={{ maxZoom: 1.1, padding: 0.3 }}
            minZoom={0.3}
            maxZoom={1.6}
            defaultEdgeOptions={{ type: "default" }}
            aria-label={t("canvas")}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
          {!nodes.length ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  onClick={() => (window.matchMedia("(min-width: 64rem)").matches ? addNode("sheetsTrigger") : setPaletteOpen(true))}
                  className="flex size-20 items-center justify-center rounded-2xl border-2 border-dashed border-ink-faint text-ink-muted outline-none hover:border-brand hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label={t("addFirstStep")}
                >
                  <Plus className="size-8" aria-hidden />
                </button>
                <p className="font-medium">{t("addFirstStep")}</p>
                <p className="text-sm text-ink-muted">{t("emptyCanvas")}</p>
              </div>
            </div>
          ) : null}
          <p className="pointer-events-none absolute right-3 bottom-3 hidden max-w-xs rounded-lg bg-panel/80 px-2.5 py-1.5 text-xs text-ink-faint backdrop-blur md:block">
            <Info className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {t("canvasHelp")}
          </p>
        </main>

        <aside aria-label={t("panel")} className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel/50 xl:flex">
          {panels}
        </aside>
      </div>

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0 pt-10">
          <SheetTitle className="sr-only">{t("nodes")}</SheetTitle>
          <SheetDescription className="sr-only">{t("nodesHelp")}</SheetDescription>
          {palette}
        </SheetContent>
      </Sheet>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="flex w-[min(400px,92vw)] flex-col p-0 pt-10 xl:hidden">
          <SheetTitle className="sr-only">{t("panel")}</SheetTitle>
          <SheetDescription className="sr-only">{t("panelHelp")}</SheetDescription>
          {panels}
        </SheetContent>
      </Sheet>

      <NodeDetails
        node={openNode}
        workflowName={name}
        executions={run?.executions ?? []}
        selectedRun={selectedRun}
        runLabel={runLabel}
        onSelectRun={setSelectedRun}
        onClose={() => setOpenId(null)}
        onChange={updateNode}
        onRename={renameNode}
        onDelete={deleteNode}
        onExecute={execute}
      />
    </div>
  );
}

/** n8n's nodes panel: search, then pick or drag a node onto the canvas. */
function Palette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const t = useTranslations("sandbox");
  const [q, setQ] = React.useState("");
  const match = (type: NodeType) => {
    const d = NODES[type];
    const s = q.trim().toLowerCase();
    return !s || `${d.label} ${d.description}`.toLowerCase().includes(s);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchNodes")} aria-label={t("searchNodes")} className="pl-8" />
        </div>
        <p className="mt-2 text-xs text-ink-faint">{t("nodesHelp")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {PALETTE_GROUPS.map((g) => {
          const types = g.types.filter(match);
          if (!types.length) return null;
          return (
            <section key={g.group} className="mb-3">
              <h3 className="px-2 py-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">{t(`group_${g.group}` as "group_trigger")}</h3>
              <ul>
                {types.map((type) => {
                  const d = NODES[type];
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DRAG_TYPE, type);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onAdd(type)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-panel-2/70 focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-panel">
                          <NodeGlyph icon={d.icon} className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{d.label}</span>
                          <span className="block text-xs text-ink-muted">{d.description}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
