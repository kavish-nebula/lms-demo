"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronLeft, FileCode2, FileText, FlaskConical, Loader2, Lock, Play, RotateCcw, TerminalSquare, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chip } from "@/components/kit/chip";
import { Surface } from "@/components/kit/surface";
import { ProgressBar } from "@/components/kit/progress-ring";
import { PythonSandbox, RUN_MS, SandboxError, type RunOutput, type RunRecordFull } from "@/components/project/python-sandbox";
import { useEnrollment } from "@/lib/enrollment";
import { useFinale } from "@/lib/finale";
import { fetchHiddenTickets, submitRun, useAutosave, useProjectWork, type SavedReport } from "@/lib/project";
import { gradeProject, type ProjectReport, type RequirementId } from "@/lib/project-grade";
import type { CapstoneBlock, Course, ProjectContent } from "@/data/types";

const CodeEditor = dynamic(() => import("@/components/project/code-editor"), { ssr: false });

type Busy = null | "booting" | "running" | "testing";

/**
 * The mini project workspace: the learner's Python files in an editor, a run
 * of the sample emails that shows every step (messages, the model's raw
 * reply, what was parsed, the decision), and the hidden tests, graded on the
 * server. Their code runs in a sandbox in the browser (python-sandbox.ts).
 */
export function ProjectWorkspace({ course, project, block, briefHref, finalHref }: { course: Course; project: ProjectContent; block: CapstoneBlock; briefHref: string; finalHref: string }) {
  const t = useTranslations("project");
  const courseId = course.course_id;
  const { enrolled, ready } = useEnrollment(courseId);
  const { work, loading } = useProjectWork(courseId, enrolled);
  const { state: finale, markDone } = useFinale(courseId);

  const starter = React.useMemo(() => Object.fromEntries(project.files.filter((f) => f.editable).map((f) => [f.path, f.content])), [project]);
  const [files, setFiles] = React.useState<Record<string, string> | null>(null);
  // start from the saved files once they've loaded (or the starter, for a learner who isn't enrolled)
  if (files === null && ready && !loading) setFiles({ ...starter, ...(work?.files ?? {}) });
  const saveState = useAutosave(courseId, enrolled, files);

  const visible = project.files.filter((f) => !f.hidden);
  const [active, setActive] = React.useState(project.entry);
  const activeFile = visible.find((f) => f.path === active) ?? visible[0]!;
  const value = activeFile.editable ? (files?.[activeFile.path] ?? activeFile.content) : activeFile.content;

  const [busy, setBusy] = React.useState<Busy>(null);
  const [tab, setTab] = React.useState("samples");
  const [sample, setSample] = React.useState<{ out: RunOutput; report: ProjectReport } | null>(null);
  const [report, setReport] = React.useState<SavedReport | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [consoleText, setConsole] = React.useState("");
  const lastReport = report ?? work?.report ?? null;

  const sandbox = React.useRef<PythonSandbox | null>(null);
  const booted = React.useRef(false);
  React.useEffect(() => {
    const sb = new PythonSandbox({
      stdout: (text) => setConsole((c) => `${c}${text}\n`.slice(-20_000)),
      status: (s) => {
        booted.current = s === "ready";
      },
    });
    sandbox.current = sb;
    return () => sb.dispose();
  }, []);

  /** Every file the run needs: the learner's, the policy, the practice model and the harness. */
  const allFiles = React.useCallback(
    () => Object.fromEntries(project.files.map((f) => [f.path, f.editable ? (files?.[f.path] ?? f.content) : f.content])),
    [project.files, files],
  );

  const explain = React.useCallback(
    (e: unknown) =>
      e instanceof SandboxError
        ? e.kind === "timeout"
          ? t("errorTimeout", { seconds: Math.round(RUN_MS / 1000) })
          : e.kind === "boot"
            ? t("errorBoot")
            : t("errorCrash", { reason: e.message })
        : t("errorCrash", { reason: e instanceof Error ? e.message : String(e) }),
    [t],
  );

  async function runSamples() {
    const sb = sandbox.current;
    if (!sb || !files || busy) return;
    setFailure(null);
    setTab("samples");
    setBusy(booted.current ? "running" : "booting");
    try {
      await sb.boot();
      setBusy("running");
      const out = await sb.run(
        allFiles(),
        project.samples.map(({ id, from, subject, body }) => ({ id, from, subject, body })),
        [1],
      );
      const graded = gradeProject(Object.fromEntries(project.samples.map((s) => [s.id, s.expect])), out.records);
      setSample({ out, report: graded });
    } catch (e) {
      setFailure(explain(e));
    } finally {
      setBusy(null);
    }
  }

  async function runTests() {
    const sb = sandbox.current;
    if (!sb || !files || busy || !enrolled) return;
    setFailure(null);
    setTab("tests");
    setBusy(booted.current ? "testing" : "booting");
    let out: RunOutput;
    try {
      const [{ runs, tickets }] = await Promise.all([fetchHiddenTickets(courseId), sb.boot()]);
      setBusy("testing");
      out = await sb.run(allFiles(), tickets, Array.from({ length: runs }, (_, i) => i + 1), RUN_MS * 2);
    } catch (e) {
      setFailure(explain(e));
      setBusy(null);
      return;
    }
    if (out.fatal) {
      // a file that doesn't load isn't a score: show the error, keep the last report
      setFailure(t("fatal", { error: `${out.fatal}${out.where ? ` (${out.where})` : ""}` }));
      setBusy(null);
      return;
    }
    try {
      const res = await submitRun(courseId, files, out.records);
      setReport(res.report);
      if (res.report.passed && !finale.done.includes("capstone")) {
        markDone("capstone", { capstoneAt: new Date().toISOString() });
        toast.success(t("passedToast"));
      }
      if (res.replanning) toast(t("planUpdated"));
    } catch (e) {
      setFailure(t("errorSubmit", { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="glass glass-sm z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-3 page-pad">
          <Button asChild variant="ghost" size="icon" aria-label={t("backToBrief")}>
            <Link href={briefHref}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-muted">
              {course.title} · {t("title")}
            </div>
            <div className="truncate font-semibold">{block.project_name}</div>
          </div>
          <span className="hidden text-xs text-ink-faint md:block" aria-live="polite">
            {t(`save_${saveState}`)}
          </span>
          <Button variant="outline" size="sm" onClick={() => void runSamples()} disabled={!files || !!busy} title={t("runHint")}>
            {busy === "running" || (busy === "booting" && tab === "samples") ? <Loader2 className="animate-spin motion-reduce:animate-none" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {t("run")}
          </Button>
          <Button variant="brand" size="sm" onClick={() => void runTests()} disabled={!files || !!busy || !enrolled}>
            {busy === "testing" || (busy === "booting" && tab === "tests") ? <Loader2 className="animate-spin motion-reduce:animate-none" data-icon="inline-start" /> : <FlaskConical data-icon="inline-start" />}
            {t("runTests")}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(22rem,28rem)]">
        {/* files */}
        <nav aria-label={t("files")} className="flex gap-1 overflow-x-auto border-b border-line p-2 lg:flex-col lg:border-r lg:border-b-0">
          <div className="hidden px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-ink-faint uppercase lg:block">{t("files")}</div>
          {visible.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setActive(f.path)}
              aria-current={f.path === activeFile.path ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                f.path === activeFile.path ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:bg-panel-2",
              )}
            >
              {f.path.endsWith(".py") ? <FileCode2 className="size-4 shrink-0" aria-hidden /> : <FileText className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{f.path}</span>
              {!f.editable ? <Lock className="ml-auto size-3 shrink-0 text-ink-faint" aria-label={t("readOnly")} /> : null}
            </button>
          ))}
          {activeFile.editable ? (
            <div className="ml-auto lg:mt-auto lg:ml-0">
              <ResetButton
                file={activeFile.path}
                onReset={() => setFiles((f) => ({ ...(f ?? {}), [activeFile.path]: starter[activeFile.path] ?? "" }))}
              />
            </div>
          ) : null}
        </nav>

        {/* editor */}
        <section className="h-[55vh] min-h-0 border-b border-line lg:h-auto lg:border-b-0">
          {files ? (
            <CodeEditor
              path={activeFile.path}
              value={value}
              readOnly={!activeFile.editable}
              label={t("editorLabel", { file: activeFile.path })}
              loadingText={t("editorLoading")}
              onChange={(v) => activeFile.editable && setFiles((f) => ({ ...(f ?? {}), [activeFile.path]: v }))}
              onRun={() => void runSamples()}
            />
          ) : (
            <div className="p-4 text-sm text-ink-muted">{t("editorLoading")}</div>
          )}
        </section>

        {/* results */}
        <section className="flex min-h-0 flex-col lg:border-l lg:border-line">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-line p-2">
              <TabsList>
                <TabsTrigger value="samples">
                  <Play aria-hidden />
                  {t("tabSamples")}
                </TabsTrigger>
                <TabsTrigger value="tests">
                  <FlaskConical aria-hidden />
                  {t("tabTests")}
                </TabsTrigger>
                <TabsTrigger value="console">
                  <TerminalSquare aria-hidden />
                  {t("tabConsole")}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3" aria-live="polite">
              {busy ? (
                <p className="mb-3 flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  {busy === "booting" ? t("booting") : busy === "testing" ? t("testing") : t("running")}
                </p>
              ) : null}
              {failure ? (
                <Surface pad="sm" className="mb-3 flex gap-2 border-err-line text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-err" aria-hidden />
                  <span className="min-w-0 break-words">{failure}</span>
                </Surface>
              ) : null}
              <TabsContent value="samples" className="flex flex-col gap-3">
                <SamplesPanel project={project} sample={sample} />
              </TabsContent>
              <TabsContent value="tests" className="flex flex-col gap-3">
                <TestsPanel report={lastReport} enrolled={enrolled} finalHref={finalHref} />
              </TabsContent>
              <TabsContent value="console">
                <ConsolePanel text={consoleText} onClear={() => setConsole("")} />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>
    </div>
  );
}

function ResetButton({ file, onReset }: { file: string; onReset: () => void }) {
  const t = useTranslations("project");
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-ink-muted">
          <RotateCcw data-icon="inline-start" />
          {t("reset")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-3 text-sm">
        <p>{t("resetConfirm", { file })}</p>
        <Button
          variant="destructive"
          size="sm"
          className="w-fit"
          onClick={() => {
            onReset();
            setOpen(false);
          }}
        >
          {t("reset")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------------- samples */

function SamplesPanel({ project, sample }: { project: ProjectContent; sample: { out: RunOutput; report: ProjectReport } | null }) {
  const t = useTranslations("project");
  if (!sample) return <p className="text-sm text-ink-muted">{t("samplesIntro")}</p>;
  const { out, report } = sample;
  if (out.fatal)
    return (
      <Surface pad="sm" className="flex gap-2 border-err-line text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-err" aria-hidden />
        <span className="min-w-0 font-mono text-[13px] break-words">{t("fatal", { error: `${out.fatal}${out.where ? ` (${out.where})` : ""}` })}</span>
      </Surface>
    );
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{t("samplesScore", { passed: report.score, total: report.total })}</p>
        <ProgressBar value={report.ratio} size="sm" aria-label={t("samplesScore", { passed: report.score, total: report.total })} />
      </div>
      {project.samples.map((s) => {
        const rec = out.records.find((r) => r.ticket === s.id);
        const graded = report.tickets.find((x) => x.id === s.id);
        return <SampleCard key={s.id} sample={s} rec={rec} notes={graded?.notes ?? []} ok={!!graded?.ok} />;
      })}
    </>
  );
}

type Decision = { intent?: unknown; order_id?: unknown; email?: unknown; reply?: unknown; action?: unknown };

function SampleCard({ sample, rec, notes, ok }: { sample: ProjectContent["samples"][number]; rec: RunRecordFull | undefined; notes: RequirementId[]; ok: boolean }) {
  const t = useTranslations("project");
  const d = (rec?.decision && typeof rec.decision === "object" ? rec.decision : {}) as Decision;
  const text = (v: unknown) => (v == null || v === "" ? t("none") : String(v));
  const actionLabel = (a: unknown) => (a === "reply" || a === "ask_for_order" || a === "handoff" ? t(`action_${a}`) : text(a));
  const messages = Array.isArray(rec?.messages) ? rec.messages : [];

  return (
    <Surface pad="sm" className={cn("flex flex-col gap-3", ok ? "border-ok-line" : "border-line")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{sample.subject}</div>
          <div className="text-xs text-ink-faint">{t("from", { from: sample.from })}</div>
        </div>
        <Chip size="sm" tone={ok ? "ok" : "err"} icon={ok ? <Check /> : <X />}>
          {ok ? t("checkOk") : t("checkMissed", { what: notes.map((n) => t(`req_${n}`)).join(", ") })}
        </Chip>
      </div>
      <p className="rounded-md border-l-2 border-line bg-panel-2/50 px-3 py-2 text-sm leading-relaxed">{sample.body}</p>

      <table className="w-full table-fixed text-[13px]">
        <thead>
          <tr className="text-left text-ink-faint">
            <th scope="col" className="w-28 pb-1 font-medium">
              <span className="sr-only">{t("field")}</span>
            </th>
            <th scope="col" className="pb-1 font-medium">
              {t("should")}
            </th>
            <th scope="col" className="pb-1 font-medium">
              {t("yourEngine")}
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label={t("fieldIntent")} want={[sample.expect.intent].flat().join(" / ")} got={text(d.intent)} />
          <Row label={t("fieldOrder")} want={text(sample.expect.order_id)} got={text(d.order_id)} />
          <Row label={t("fieldEmail")} want={text(sample.expect.email)} got={text(d.email)} />
          <Row label={t("fieldAction")} want={actionLabel(sample.expect.action)} got={actionLabel(d.action)} />
        </tbody>
      </table>
      {typeof d.reply === "string" && d.reply ? (
        <p className="text-sm">
          <span className="font-medium text-ink-faint">{t("fieldReply")}: </span>
          {d.reply}
        </p>
      ) : null}

      {rec?.error ? (
        <p className="rounded-md border border-err-line bg-err-soft px-3 py-2 font-mono text-[12.5px] break-words text-err">
          {t("failedAt", { step: rec.step, error: `${rec.error}${rec.where ? ` (${rec.where})` : ""}` })}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {messages.length ? (
          <Step title={t("stepMessages", { count: messages.length })}>
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{m.role}</span>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{m.content}</pre>
              </div>
            ))}
          </Step>
        ) : null}
        {rec?.raw != null ? (
          <Step title={t("stepRaw")}>
            <pre className="whitespace-pre-wrap">{rec.raw}</pre>
          </Step>
        ) : null}
        {rec?.parsed !== undefined ? (
          <Step title={t("stepParsed")}>
            <pre className="whitespace-pre-wrap">{JSON.stringify(rec.parsed, null, 2)}</pre>
          </Step>
        ) : null}
        {rec?.decision !== undefined ? (
          <Step title={t("stepDecision")}>
            <pre className="whitespace-pre-wrap">{JSON.stringify(rec.decision, null, 2)}</pre>
          </Step>
        ) : null}
      </div>
    </Surface>
  );
}

function Row({ label, want, got }: { label: string; want: string; got: string }) {
  const same = want.toLowerCase() === got.toLowerCase() || want.split(" / ").includes(got);
  return (
    <tr>
      <th scope="row" className="py-0.5 pr-2 text-left font-normal text-ink-faint">
        {label}
      </th>
      <td className="truncate py-0.5 pr-2 font-mono" title={want}>
        {want}
      </td>
      <td className={cn("truncate py-0.5 font-mono", same ? "text-ok" : "text-err")} title={got}>
        {got}
      </td>
    </tr>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-line bg-panel-2/40">
      <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-ink-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60">{title}</summary>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-2 font-mono text-[12.5px] leading-relaxed">{children}</div>
    </details>
  );
}

/* ---------------------------------------------------------------- tests */

function TestsPanel({ report, enrolled, finalHref }: { report: SavedReport | null; enrolled: boolean; finalHref: string }) {
  const t = useTranslations("project");
  const format = useFormatter();
  return (
    <>
      <p className="text-sm text-ink-muted">{t("testsIntro")}</p>
      {!enrolled ? (
        <Surface pad="sm" className="text-sm">
          {t("testsEnrol")}
        </Surface>
      ) : !report ? (
        <p className="text-sm text-ink-faint">{t("noTests")}</p>
      ) : (
        <>
          <Surface pad="sm" className={cn("flex flex-col gap-2", report.passed ? "border-ok-line" : "border-line")}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" tone={report.passed ? "ok" : "warn"} icon={report.passed ? <Check /> : <TriangleAlert />}>
                {report.passed ? t("passed") : t("notPassed")}
              </Chip>
              <span className="text-sm font-medium tabular-nums">{t("score", { score: report.score, total: report.total, percent: Math.round(report.ratio * 100) })}</span>
            </div>
            <ProgressBar value={report.ratio} size="sm" aria-label={t("score", { score: report.score, total: report.total, percent: Math.round(report.ratio * 100) })} />
            {report.criticalFailed ? <p className="text-sm text-err">{t("criticalFailed")}</p> : null}
            <span className="text-xs text-ink-faint">{t("lastRun", { time: format.relativeTime(new Date(report.at)) })}</span>
            {report.passed ? (
              <Button asChild size="sm" variant="brand" className="mt-1 w-fit">
                <Link href={finalHref}>
                  {t("continueFinal")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </Surface>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t("byRequirement")}</h2>
            <ul className="flex flex-col gap-2">
              {report.requirements.map((r) => {
                const full = r.passed === r.total;
                return (
                  <li key={r.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      {full ? <Check className="size-4 shrink-0 text-ok" aria-hidden /> : <X className="size-4 shrink-0 text-err" aria-hidden />}
                      <span className="flex-1">{t(`req_${r.id}`)}</span>
                      <span className="text-xs text-ink-muted tabular-nums">
                        {r.passed}/{r.total}
                      </span>
                    </div>
                    {!full ? <p className="pl-6 text-xs text-ink-muted">{t(`hint_${r.id}`)}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t("hiddenEmails")}</h2>
            <ul className="flex flex-col gap-1.5">
              {report.tickets.map((x, i) => (
                <li key={x.id} className="flex items-start gap-2 text-sm">
                  {x.ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-err" aria-hidden />}
                  <span className="min-w-0">
                    {t("hiddenEmail", { n: i + 1 })}
                    {x.ok ? <span className="text-ink-faint"> · {t("handled")}</span> : <span className="text-ink-muted"> · {x.notes.map((n) => t(`req_${n}`)).join(", ")}</span>}
                    {x.error ? <span className="block font-mono text-xs break-words text-err">{x.error}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- console */

function ConsolePanel({ text, onClear }: { text: string; onClear: () => void }) {
  const t = useTranslations("project");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!text}>
          {t("clearConsole")}
        </Button>
      </div>
      {text ? (
        <pre className="rounded-md border border-line bg-panel-2/50 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">{text}</pre>
      ) : (
        <p className="text-sm text-ink-muted">{t("consoleEmpty")}</p>
      )}
    </div>
  );
}
