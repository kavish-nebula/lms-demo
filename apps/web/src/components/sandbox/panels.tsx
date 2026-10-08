"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown, CircleDashed, ClipboardCheck, Hash, Lightbulb, Play, Sheet, TriangleAlert, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CapstoneReport, RequirementResult } from "@/data/mock-capstone-grader";
import type { CapstoneBlock } from "@/data/types";
import type { Execution, SNode, World } from "@/lib/sandbox/types";

const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{children}</h3>;

function Status({ result }: { result?: RequirementResult }) {
  const t = useTranslations("sandbox");
  if (!result)
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-ink-faint" title={t("notChecked")}>
        <CircleDashed className="size-4" aria-hidden />
        <span className="sr-only">{t("notChecked")}</span>
      </span>
    );
  return result.passed ? (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok text-on-ok [&_svg]:size-3">
      <Check aria-hidden />
      <span className="sr-only">{t("met")}</span>
    </span>
  ) : (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-err-soft text-err [&_svg]:size-3">
      <X aria-hidden />
      <span className="sr-only">{t("notMet")}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- brief */

export function BriefPanel({ block, report, onReset }: { block: CapstoneBlock; report?: CapstoneReport; onReset: () => void }) {
  const t = useTranslations("sandbox");
  const [confirm, setConfirm] = React.useState(false);
  const sb = block.sandbox;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <H>{t("requirements")}</H>
        <ol className="flex flex-col gap-2.5">
          {block.requirements.map((r) => (
            <li key={r.id} className="flex gap-2.5 text-sm leading-snug">
              <Status result={report?.results.find((x) => x.id === r.id)} />
              <span>{r.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2.5">
        <H>{t("dataContract")}</H>
        <p className="text-xs text-ink-muted">{t("dataContractBody")}</p>
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-xs">
            <tbody>
              {block.data_contract.map((d) => (
                <tr key={d.field} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-2.5 py-1.5 text-left font-mono font-medium text-brand-ink">
                    {d.field}
                  </th>
                  <td className="px-2.5 py-1.5">
                    {d.rule}
                    <span className="block font-mono text-ink-faint">{d.example}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <H>{t("edgeCases")}</H>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
          {block.edge_cases.map((e) => (
            <li key={e} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
              {e}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5">
        <H>{t("whatYouHave")}</H>
        <ul className="flex flex-col gap-2 text-sm">
          {sb.sheets.map((s) => (
            <li key={s.name} className="flex gap-2">
              <Sheet className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
              <span>
                <span className="font-medium">
                  {sb.document} › {s.name}
                </span>
                <span className="block font-mono text-xs text-ink-faint">{s.columns.join(" · ")}</span>
                <span className="block text-xs text-ink-muted">{s.note}</span>
              </span>
            </li>
          ))}
          {sb.channels.map((c) => (
            <li key={c.name} className="flex gap-2">
              <Hash className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
              <span>
                <span className="font-medium">{c.name}</span> <span className="text-xs text-ink-muted">{c.note}</span>
              </span>
            </li>
          ))}
          <li className="flex gap-2 text-xs text-ink-muted">
            <UserRoundPlus className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            {t("credentials", { list: sb.credentials.map((c) => c.name).join(", ") })}
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2.5">
        <H>{t("sampleRows")}</H>
        <p className="text-xs text-ink-muted">{t("sampleRowsBody", { count: sb.sample.length })}</p>
        <ol className="flex flex-col gap-1.5 font-mono text-xs">
          {sb.sample.map((s, i) => (
            <li key={i} className="rounded-md border border-line bg-panel-2/40 px-2.5 py-1.5">
              <span className="text-ink-faint">{i + 1}.</span> {JSON.stringify(s.row["Full name"])} · {JSON.stringify(s.row["Email address"])} · {JSON.stringify(s.row["Plan"])} ·{" "}
              {JSON.stringify(s.row["Signed up on"])}
              {s.note ? <span className="mt-0.5 block font-sans text-warn">{s.note}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="border-t border-line pt-4">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">{t("resetConfirm")}</span>
            <Button size="sm" variant="destructive" onClick={onReset}>
              {t("resetYes")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              {t("resetNo")}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            {t("reset")}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- runs */

export function RunsPanel({
  executions,
  world,
  nodes,
  selectedRun,
  stale,
  runLabel,
  notes,
  onSelect,
  onExecute,
}: {
  executions: Execution[];
  world: World | null;
  nodes: SNode[];
  selectedRun: number | null;
  stale: boolean;
  runLabel: (e: Execution) => string;
  notes: (string | undefined)[];
  onSelect: (n: number) => void;
  onExecute: () => void;
}) {
  const t = useTranslations("sandbox");
  if (!executions.length || !world)
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-ink-muted">
        <p>{t("runsEmpty", { count: notes.length })}</p>
        <Button variant="brand" onClick={onExecute}>
          <Play data-icon="inline-start" />
          {t("executeWorkflow")}
        </Button>
      </div>
    );
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const rejected = world.sheets["Rejected sign-ups"] ?? [];
  return (
    <div className="flex flex-col gap-6">
      {stale ? (
        <p role="status" className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          {t("stale")}
        </p>
      ) : null}
      <section className="flex flex-col gap-2">
        <H>{t("executions")}</H>
        <ol className="flex flex-col gap-1">
          {executions.map((e) => (
            <li key={e.n}>
              <button
                type="button"
                aria-pressed={selectedRun === e.n}
                onClick={() => onSelect(e.n)}
                className={cn(
                  "flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  selectedRun === e.n ? "border-brand-line bg-brand-soft" : "border-transparent hover:bg-panel-2/60",
                )}
              >
                {e.status === "success" ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label={t("runOk")} />
                ) : e.status === "error" ? (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-err" aria-label={t("runError")} />
                ) : (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-label={t("runSkipped")} />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">{runLabel(e)}</span>
                  {notes[e.n - 1] ? <span className="block text-xs text-warn">{notes[e.n - 1]}</span> : null}
                  {e.status === "error" && e.error ? (
                    <span className="block text-xs break-words text-err">
                      {nameOf(e.error.nodeId)}: {e.error.message}
                    </span>
                  ) : e.status === "skipped" ? (
                    <span className="block text-xs text-ink-faint">{t("skipped")}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <H>{t("inHubspot", { count: world.crm.contacts.length })}</H>
        {world.crm.contacts.length ? (
          <div className="overflow-auto rounded-lg border border-line">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="bg-panel-2/60 text-left">
                  {["email", "fullName", "plan", "signupDate"].map((k) => (
                    <th key={k} scope="col" className="px-2 py-1.5 font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {world.crm.contacts.map((c) => (
                  <tr key={c.id} className="border-t border-line/60">
                    <td className="px-2 py-1.5 whitespace-pre">{JSON.stringify(c.email)}</td>
                    <td className="px-2 py-1.5 whitespace-pre">{JSON.stringify(c.fullName)}</td>
                    <td className="px-2 py-1.5">{JSON.stringify(c.plan)}</td>
                    <td className="px-2 py-1.5">{JSON.stringify(c.signupDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">{t("nothingYet")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <H>{t("inSlack", { count: world.slack.length })}</H>
        {world.slack.length ? (
          <ul className="flex flex-col gap-1.5">
            {world.slack.map((m) => (
              <li key={m.seq} className="rounded-lg border border-line bg-panel-2/40 px-2.5 py-1.5 text-sm">
                <span className={cn("mr-1.5 font-mono text-xs font-medium", m.channel === "#ops-alerts" ? "text-warn" : "text-brand-ink")}>{m.channel}</span>
                <span className="break-words whitespace-pre-wrap">{m.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">{t("nothingYet")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <H>{t("inRejected", { count: rejected.length })}</H>
        {rejected.length ? (
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {rejected.map((r, i) => (
              <li key={i} className="rounded-md border border-line px-2.5 py-1.5 break-words">
                {["Full name", "Email", "Reason", "Received"].map((c) => `${c}: ${JSON.stringify(r[c] ?? "")}`).join(" · ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">{t("nothingYet")}</p>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- check */

export function CheckPanel({ block, report, checks, resultsHref, onCheck }: { block: CapstoneBlock; report?: CapstoneReport; checks: number; resultsHref: string; onCheck: () => void }) {
  const t = useTranslations("sandbox");
  return (
    <div className="flex flex-col gap-5">
      {!report ? (
        <div className="flex flex-col items-start gap-3 text-sm text-ink-muted">
          <p>{t("checkIntro")}</p>
          <Button variant="brand" onClick={onCheck}>
            <ClipboardCheck data-icon="inline-start" />
            {t("checkProject")}
          </Button>
        </div>
      ) : (
        <>
          {report.accepted ? (
            <div className="flex flex-col gap-3 rounded-card border border-ok-line bg-ok-soft p-4">
              <p className="text-base font-semibold text-ok">{t("accepted")}</p>
              <p className="text-sm">{t("acceptedBody")}</p>
              <Button asChild variant="brand" className="w-fit">
                <Link href={resultsHref}>
                  {t("seeResults")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold">{t("score", { passed: report.passed, total: report.total })}</p>
              <p className="text-xs text-ink-muted">{t("checkedTimes", { count: checks })}</p>
            </div>
          )}
          <ol className="flex flex-col gap-3">
            {report.results.map((r) => (
              <ResultRow key={r.id} result={r} text={block.requirements.find((x) => x.id === r.id)?.text ?? r.id} />
            ))}
          </ol>
          {!report.accepted ? (
            <Button variant="outline" className="w-fit" onClick={onCheck}>
              <ClipboardCheck data-icon="inline-start" />
              {t("checkAgain")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function ResultRow({ result, text }: { result: RequirementResult; text: string }) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = React.useState(false);
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border p-3", result.passed ? "border-line" : "border-err-line bg-err-soft/40")}>
      <div className="flex gap-2.5 text-sm leading-snug">
        <Status result={result} />
        <span className={cn(result.passed && "text-ink-muted")}>{text}</span>
      </div>
      {!result.passed ? (
        <>
          <ul className="flex flex-col gap-1 pl-7 text-xs text-ink-muted">
            {result.details.map((d) => (
              <li key={d} className="list-disc break-words">
                {d}
              </li>
            ))}
          </ul>
          <Collapsible open={open} onOpenChange={setOpen} className="pl-7">
            <CollapsibleTrigger className="flex items-center gap-1 rounded text-xs font-medium text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <Lightbulb className="size-3.5" aria-hidden />
              {t(open ? "hideHint" : "showHint")}
              <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-1.5 rounded-md bg-panel-2/60 p-2 text-xs leading-relaxed">{result.hint}</p>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : null}
    </li>
  );
}
