"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isExpression, preview, type Scope } from "@/lib/sandbox/expression";
import { NODES, OPERATORS, newId, type FieldDef } from "@/lib/sandbox/nodes";
import type { Assignment, ColumnValue, Condition, Params, ParamValue, SNode } from "@/lib/sandbox/types";

/**
 * A node's parameter form, generated from its definition. Text fields take
 * fixed text or an expression in {{ }}; an expression shows its result for
 * the first input item of the selected run, as n8n's editor does.
 */
export function ParamFields({ node, scope, onChange }: { node: SNode; scope: Scope | null; onChange: (params: Params) => void }) {
  const def = NODES[node.type];
  const set = (key: string, v: ParamValue) => onChange({ ...node.params, [key]: v });
  const fields = def.fields.filter((f) => !f.show || f.show(node.params));
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <Field key={f.key} id={`${node.id}-${f.key}`} field={f} params={node.params} scope={scope} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

function Field({ id, field, params, scope, onChange }: { id: string; field: FieldDef; params: Params; scope: Scope | null; onChange: (v: ParamValue) => void }) {
  const value = params[field.key];
  const label = (
    <Label htmlFor={id} className="text-xs font-medium text-ink-muted">
      {field.label}
    </Label>
  );
  const hint = field.hint ? <p className="text-xs text-ink-faint">{field.hint}</p> : null;

  switch (field.kind) {
    case "select":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <SelectField id={id} value={String(value ?? "")} options={field.options} onChange={onChange} />
          {hint}
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            {label}
            {hint}
          </div>
          <Switch id={id} checked={!!value} onCheckedChange={onChange} />
        </div>
      );
    case "number":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Input id={id} type="number" min={field.min} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className="w-32" />
          {hint}
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <ExprInput id={id} value={String(value ?? "")} placeholder={field.placeholder} multiline={field.multiline} scope={scope} onChange={onChange} />
          {hint}
        </div>
      );
    case "assignments":
      return <Assignments id={id} label={field.label} list={(value as Assignment[]) ?? []} scope={scope} onChange={onChange} />;
    case "conditions":
      return <Conditions id={id} label={field.label} list={(value as Condition[]) ?? []} scope={scope} onChange={onChange} />;
    case "columns":
      return <Columns id={id} label={field.label} columns={field.columns(params)} list={(value as ColumnValue[]) ?? []} scope={scope} onChange={onChange} />;
  }
}

function SelectField({ id, value, options, onChange, className }: { id: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; className?: string }) {
  const t = useTranslations("sandbox");
  const real = options.filter((o) => o.value !== "");
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={t("choose")} />
      </SelectTrigger>
      <SelectContent>
        {real.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Fixed text or an expression; expressions are monospaced and preview their result. */
export function ExprInput({
  id,
  value,
  placeholder,
  multiline,
  scope,
  onChange,
  ariaLabel,
}: {
  id: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  scope: Scope | null;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const t = useTranslations("sandbox");
  const expr = isExpression(value);
  const result = expr ? preview(value, scope) : null;
  const cls = cn(expr && "font-mono text-[13px] text-brand-ink");
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {multiline ? (
        <Textarea id={id} aria-label={ariaLabel} value={value} placeholder={placeholder} rows={3} spellCheck={false} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <Input id={id} aria-label={ariaLabel} value={value} placeholder={placeholder} spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
      {expr ? (
        <div className={cn("rounded-md px-2 py-1 font-mono text-xs break-all", !scope ? "text-ink-faint" : result!.ok ? "bg-panel-2/60 text-ink-muted" : "bg-err-soft text-err")}>
          {!scope ? t("previewNeedsRun") : result!.ok ? <PreviewText text={result!.text} /> : `${t("previewError")} ${result!.text}`}
        </div>
      ) : null}
    </div>
  );
}

function PreviewText({ text }: { text: string }) {
  const t = useTranslations("sandbox");
  if (text === "") return <span className="italic">{t("emptyResult")}</span>;
  const shown = text.replace(/^\s+|\s+$/g, (m) => m.replace(/\t/g, "→").replace(/ /g, "·"));
  return <>{shown}</>;
}

function Assignments({ id, label, list, scope, onChange }: { id: string; label: string; list: Assignment[]; scope: Scope | null; onChange: (v: Assignment[]) => void }) {
  const t = useTranslations("sandbox");
  const update = (i: number, patch: Partial<Assignment>) => onChange(list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-ink-muted">{label}</legend>
      {list.length === 0 ? <p className="text-xs text-ink-faint">{t("noFields")}</p> : null}
      {list.map((a, i) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel-2/30 p-2.5">
          <div className="flex items-center gap-2">
            <Input aria-label={t("fieldName")} placeholder={t("fieldName")} value={a.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1 font-mono text-[13px]" />
            <SelectField
              id={`${id}-${a.id}-type`}
              value={a.type}
              className="w-28"
              options={[
                { value: "string", label: "String" },
                { value: "number", label: "Number" },
                { value: "boolean", label: "Boolean" },
              ]}
              onChange={(v) => update(i, { type: v as Assignment["type"] })}
            />
            <Button variant="ghost" size="icon-sm" aria-label={t("removeField", { name: a.name || i + 1 })} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
          <ExprInput id={`${id}-${a.id}-value`} ariaLabel={t("fieldValue", { name: a.name || i + 1 })} value={a.value} placeholder={t("valuePlaceholder")} scope={scope} onChange={(v) => update(i, { value: v })} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange([...list, { id: newId("a"), name: "", type: "string", value: "" }])}>
        <Plus data-icon="inline-start" />
        {t("addField")}
      </Button>
    </fieldset>
  );
}

function Conditions({ id, label, list, scope, onChange }: { id: string; label: string; list: Condition[]; scope: Scope | null; onChange: (v: Condition[]) => void }) {
  const t = useTranslations("sandbox");
  const update = (i: number, patch: Partial<Condition>) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const groups = ["String", "Number", "Boolean"] as const;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-ink-muted">{label}</legend>
      {list.length === 0 ? <p className="text-xs text-ink-faint">{t("noConditions")}</p> : null}
      {list.map((c, i) => {
        const op = OPERATORS.find((o) => o.id === c.op);
        return (
          <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel-2/30 p-2.5">
            <ExprInput id={`${id}-${c.id}-left`} ariaLabel={t("conditionValue", { n: i + 1 })} value={c.left} placeholder="{{ $json.email }}" scope={scope} onChange={(v) => update(i, { left: v })} />
            <div className="flex items-start gap-2">
              <Select value={c.op} onValueChange={(v) => update(i, { op: v as Condition["op"] })}>
                <SelectTrigger aria-label={t("conditionOperator", { n: i + 1 })} className="w-48 shrink-0">
                  <SelectValue>{op ? `${op.type}: ${op.label}` : null}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {OPERATORS.filter((o) => o.type === g).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {op?.unary ? <span className="flex-1" /> : <ExprInput id={`${id}-${c.id}-right`} ariaLabel={t("conditionCompare", { n: i + 1 })} value={c.right} scope={scope} onChange={(v) => update(i, { right: v })} />}
              <Button variant="ghost" size="icon-sm" aria-label={t("removeCondition", { n: i + 1 })} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange([...list, { id: newId("c"), left: "", op: "s.notEmpty", right: "" }])}>
        <Plus data-icon="inline-start" />
        {t("addCondition")}
      </Button>
    </fieldset>
  );
}

function Columns({ id, label, columns, list, scope, onChange }: { id: string; label: string; columns: string[]; list: ColumnValue[]; scope: Scope | null; onChange: (v: ColumnValue[]) => void }) {
  const t = useTranslations("sandbox");
  if (!columns.length) return <p className="text-xs text-ink-faint">{t("chooseSheetFirst")}</p>;
  const valueOf = (c: string) => list.find((v) => v.column === c)?.value ?? "";
  const set = (c: string, v: string) => onChange([...list.filter((x) => x.column !== c), { column: c, value: v }]);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-medium text-ink-muted">{label}</legend>
      {columns.map((c) => (
        <div key={c} className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-${c}`} className="font-mono text-xs">
            {c}
          </Label>
          <ExprInput id={`${id}-${c}`} value={valueOf(c)} scope={scope} onChange={(v) => set(c, v)} />
        </div>
      ))}
    </fieldset>
  );
}
