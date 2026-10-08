"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Play, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { NodeGlyph } from "@/components/n8n/node-glyph";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataView } from "@/components/sandbox/data-view";
import { ParamFields } from "@/components/sandbox/fields";
import { NODES, outputsOf } from "@/lib/sandbox/nodes";
import type { Scope } from "@/lib/sandbox/expression";
import type { Execution, Handle, NodeSettings, SNode } from "@/lib/sandbox/types";

type Props = {
  node: SNode | null;
  workflowName: string;
  executions: Execution[];
  selectedRun: number | null;
  runLabel: (e: Execution) => string;
  onSelectRun: (n: number) => void;
  onClose: () => void;
  onChange: (node: SNode) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExecute: () => void;
};

/**
 * The node details view, n8n's NDV: what came in, the node's parameters and
 * settings, and what went out, for the run picked at the top.
 */
export function NodeDetails(props: Props) {
  const { node } = props;
  return (
    <Dialog open={!!node} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="flex h-[92dvh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1280px,96vw)]">{node ? <Body key={node.id} {...props} node={node} /> : null}</DialogContent>
    </Dialog>
  );
}

function Body({ node, workflowName, executions, selectedRun, runLabel, onSelectRun, onChange, onRename, onDelete, onExecute }: Props & { node: SNode }) {
  const t = useTranslations("sandbox");
  const def = NODES[node.type];
  const [name, setName] = React.useState(node.name);
  const exec = executions.find((e) => e.n === selectedRun) ?? null;
  const run = exec?.runs[node.id];
  // previews read the first item that reached this node: in the picked run, or the first run it was reached in
  const source = run?.input.length ? { exec: exec!, run } : executions.map((e) => ({ exec: e, run: e.runs[node.id] })).find((x) => x.run?.input.length);
  const scope: Scope | null = source ? { item: source.run!.input[0]!, items: source.run!.input, workflowName, execution: source.exec.n } : null;
  const outs = outputsOf(node);
  const setSettings = (patch: Partial<NodeSettings>) => onChange({ ...node, settings: { ...node.settings, ...patch } });

  const emptyIn = !executions.length ? t("inputNoRun") : def.trigger ? t("inputTrigger") : t("inputNotReached", { run: selectedRun ?? 1 });
  const emptyOut = !executions.length ? t("outputNoRun") : t("outputNone");

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-line py-3 pr-12 pl-4">
        <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-panel-2">
          <NodeGlyph icon={def.icon} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <DialogTitle className="sr-only">{node.name}</DialogTitle>
          <DialogDescription className="text-xs text-ink-faint">{def.label}</DialogDescription>
          <Input
            aria-label={t("nodeName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() && name !== node.name ? onRename(node.id, name.trim()) : setName(node.name))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-8 w-64 max-w-full border-transparent bg-transparent px-1 text-base font-semibold hover:border-line"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {executions.length ? (
            <Select value={String(selectedRun ?? executions[0]!.n)} onValueChange={(v) => onSelectRun(Number(v))}>
              <SelectTrigger aria-label={t("pickRun")} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {executions.map((e) => (
                  <SelectItem key={e.n} value={String(e.n)}>
                    {runLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="brand" onClick={onExecute}>
            <Play data-icon="inline-start" />
            {t("executeWorkflow")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("deleteNode", { name: node.name })} onClick={() => onDelete(node.id)}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(380px,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
        <section aria-label={t("input")} className="order-2 flex min-h-0 flex-col gap-2 border-line p-4 lg:order-1 lg:overflow-auto lg:border-r">
          <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("input")}</h3>
          <DataView items={run?.input ?? []} emptyLabel={emptyIn} />
        </section>

        <section aria-label={t("parameters")} className="order-1 min-h-0 border-b border-line bg-panel/40 p-4 lg:order-2 lg:overflow-auto lg:border-b-0">
          <Tabs defaultValue="parameters">
            <TabsList>
              <TabsTrigger value="parameters">{t("parameters")}</TabsTrigger>
              {!def.trigger ? <TabsTrigger value="settings">{t("settings")}</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="parameters" className="pt-4">
              <p className="mb-4 text-sm text-ink-muted">{def.description}</p>
              {def.fields.length ? <ParamFields node={node} scope={scope} onChange={(params) => onChange({ ...node, params })} /> : <p className="text-sm text-ink-faint">{t("noParameters")}</p>}
            </TabsContent>
            {!def.trigger ? (
              <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
                <SettingToggle id={`${node.id}-always`} label={t("alwaysOutput")} hint={t("alwaysOutputHint")} checked={node.settings.alwaysOutput} onChange={(v) => setSettings({ alwaysOutput: v })} />
                <SettingToggle id={`${node.id}-retry`} label={t("retryOnFail")} hint={t("retryOnFailHint")} checked={node.settings.retryOnFail} onChange={(v) => setSettings({ retryOnFail: v })} />
                {node.settings.retryOnFail ? (
                  <div className="flex flex-wrap gap-4 pl-1">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${node.id}-tries`} className="text-xs text-ink-muted">
                        {t("maxTries")}
                      </Label>
                      <Input id={`${node.id}-tries`} type="number" min={2} max={5} value={node.settings.maxTries} onChange={(e) => setSettings({ maxTries: Number(e.target.value) })} className="w-24" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${node.id}-wait`} className="text-xs text-ink-muted">
                        {t("waitBetween")}
                      </Label>
                      <Input id={`${node.id}-wait`} type="number" min={0} step={500} value={node.settings.waitMs} onChange={(e) => setSettings({ waitMs: Number(e.target.value) })} className="w-28" />
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${node.id}-onerror`} className="text-xs font-medium text-ink-muted">
                    {t("onError")}
                  </Label>
                  <Select value={node.settings.onError} onValueChange={(v) => setSettings({ onError: v as NodeSettings["onError"] })}>
                    <SelectTrigger id={`${node.id}-onerror`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stop">{t("onErrorStop")}</SelectItem>
                      <SelectItem value="continue">{t("onErrorContinue")}</SelectItem>
                      <SelectItem value="errorOutput">{t("onErrorOutput")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-ink-faint">{t("onErrorHint")}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${node.id}-notes`} className="text-xs font-medium text-ink-muted">
                    {t("notes")}
                  </Label>
                  <Textarea id={`${node.id}-notes`} rows={2} value={node.settings.notes} onChange={(e) => setSettings({ notes: e.target.value })} />
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        </section>

        <section aria-label={t("output")} className="order-3 flex min-h-0 flex-col gap-2 border-t border-line p-4 lg:overflow-auto lg:border-t-0 lg:border-l">
          <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("output")}</h3>
          {run?.error ? (
            <div role="status" className={cn("flex gap-2 rounded-lg border p-3 text-sm", run.status === "error" ? "border-err-line bg-err-soft text-err" : "border-warn-line bg-warn-soft text-warn")}>
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="font-medium break-words">{run.error}</span>
                {run.tries > 1 ? (
                  <span className="flex items-center gap-1 text-xs">
                    <RefreshCw className="size-3" aria-hidden />
                    {t("triedTimes", { count: run.tries })}
                  </span>
                ) : null}
                {run.status !== "error" ? <span className="text-xs">{t(node.settings.onError === "errorOutput" ? "erroredToOutput" : "erroredContinued")}</span> : null}
              </div>
            </div>
          ) : run && run.tries > 1 ? (
            <p className="flex items-center gap-1.5 text-xs text-ok">
              <RefreshCw className="size-3" aria-hidden />
              {t("succeededAfter", { count: run.tries })}
            </p>
          ) : null}
          {outs.length > 1 ? (
            <Tabs defaultValue={outs[0]}>
              <TabsList>
                {outs.map((h) => (
                  <TabsTrigger key={h} value={h}>
                    {t(`branch_${h}` as "branch_main")} ({run?.output[h]?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
              {outs.map((h: Handle) => (
                <TabsContent key={h} value={h} className="pt-2">
                  <DataView items={run?.output[h] ?? []} emptyLabel={emptyOut} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <DataView items={run?.output.main ?? []} emptyLabel={emptyOut} />
          )}
        </section>
      </div>
    </>
  );
}

function SettingToggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
