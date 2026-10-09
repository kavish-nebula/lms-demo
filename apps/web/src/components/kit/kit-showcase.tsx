"use client";

/**
 * Internal component showcase (/kit). Every primitive and composite in its
 * main states, with a theme toggle. Internal tooling, so copy here is plain
 * English rather than catalog strings.
 */
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  Clock3,
  GraduationCap,
  Loader2,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip, DeltaChip } from "@/components/kit/chip";
import { Surface, GlassCard } from "@/components/kit/surface";
import { KpiRow, StatTile } from "@/components/kit/stat-tile";
import { ProgressBar, ProgressRing } from "@/components/kit/progress-ring";
import { Segmented } from "@/components/kit/segmented";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/kit/states";
import { StageChip, StageDots, TopicRail } from "@/components/kit/stage";
import { CodeBlock } from "@/components/kit/code-block";
import { PipelineDiagram } from "@/components/kit/pipeline";
import { ThemeToggle } from "@/components/kit/theme-toggle";
import { NumberTicker } from "@/components/kit/number-ticker";
import { TickerTape } from "@/components/kit/ticker-tape";
import { Logo } from "@/components/kit/logo";
import { FillQuestion, MatchQuestion, McQuestion, TieredHints, Feedback } from "@/components/player/items";
import { ProgramCard } from "@/components/course/program-card";
import { deriveProgress } from "@/lib/course-progress";
import { ResumeCard } from "@/components/learn/resume-card";
import { CredentialCard } from "@/components/learn/credential-card";
import { UserAvatar } from "@/components/shell/user-badge";
import { STAGE_ORDER } from "@/lib/stages";
import type { Course, Credential, Pipeline } from "@/data/types";

const SECTIONS = [
  ["tokens", "Tokens"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["chips", "Chips"],
  ["forms", "Forms"],
  ["surfaces", "Surfaces"],
  ["stats", "Stats & progress"],
  ["tickers", "Tickers"],
  ["stages", "Stages"],
  ["learning", "Learning items"],
  ["overlays", "Overlays"],
  ["data", "Table & states"],
  ["composites", "Composites"],
] as const;

const DEMO_PIPELINE: Pipeline = {
  nodes: [
    { id: "a", kind: "trigger", label: "Form submitted", sub: "Trigger", x: 0, y: 60, state: "ok" },
    { id: "b", kind: "logic", label: "Is urgent?", sub: "Filter", x: 220, y: 60, state: "running" },
    { id: "c", kind: "action", label: "Post to Slack", sub: "Action", x: 440, y: 0, state: "idle" },
    { id: "d", kind: "data", label: "Add sheet row", sub: "Action", x: 440, y: 120, state: "error" },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", state: "ok" },
    { id: "bc", source: "b", target: "c", state: "idle" },
    { id: "bd", source: "b", target: "d", state: "error" },
  ],
};

export function KitShowcase({
  course,
  credential,
}: {
  /** the course composites need one; they are skipped while the catalog is empty */
  course: Course | undefined;
  credential: Credential;
}) {
  const [tickerValue, setTickerValue] = React.useState(1284);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-4 page-pad">
          <Logo wordmark={false} className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
          <Chip tone="accent" size="sm" className="hidden sm:inline-flex">
            Component kit
          </Chip>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/learn">Open app</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-10 page-pad py-8">
        <nav aria-label="Kit sections" className="sticky top-[calc(var(--nav-h)+32px)] hidden h-fit w-44 shrink-0 lg:block">
          <ul className="flex flex-col gap-0.5 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-ink-muted hover:bg-panel-2 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-14 pb-24">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Component kit</h1>
            <p className="mt-2 max-w-2xl text-ink-muted">
              Frosted Aura (light) for the app, Aurora (dark) for marketing and auth. Toggle the theme to check both. Every
              component uses tokens from packages/ui/tokens.css.
            </p>
          </div>

          <Section id="tokens" title="Tokens">
            <SwatchGroup title="Surfaces & inks" vars={["--bg", "--panel", "--panel2", "--line", "--text", "--muted", "--faint"]} />
            <SwatchGroup title="Brand" vars={["--accent", "--accent-ink", "--accent-deep", "--accent-soft", "--accent-line", "--coral", "--teal", "--plum"]} />
            <SwatchGroup title="Status (ink / soft / line)" vars={["--ok", "--ok-soft", "--ok-line", "--err", "--err-soft", "--err-line", "--info", "--warn-ink"]} />
            <SwatchGroup
              title="Stages"
              vars={["--stage-hook", "--stage-explain", "--stage-worked", "--stage-guided", "--stage-lab", "--stage-project", "--stage-gate", "--stage-reflect", "--stage-review"]}
            />
            <SwatchGroup title="Charts" vars={["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]} />
          </Section>

          <Section id="type" title="Typography">
            <div className="flex flex-col gap-3">
              {[
                ["text-4xl", "Display 56"],
                ["text-3xl", "Heading 43.5"],
                ["text-2xl", "Heading 32"],
                ["text-xl", "Title 24"],
                ["text-lg", "Lead 19.5"],
                ["text-base", "Body 17 — the quick brown fox jumps over the lazy dog."],
                ["text-sm", "Small 15.5 — secondary text and labels."],
                ["text-xs", "Caption 13.5 — meta and hints."],
              ].map(([cls, label]) => (
                <div key={cls} className="flex items-baseline gap-4">
                  <code className="w-20 shrink-0 font-mono text-xs text-ink-faint">{cls}</code>
                  <span className={`${cls} ${cls.includes("xl") ? "font-semibold tracking-tight" : ""}`}>{label}</span>
                </div>
              ))}
              <div className="flex items-baseline gap-4">
                <code className="w-20 shrink-0 font-mono text-xs text-ink-faint">font-mono</code>
                <span className="font-mono">print(type(age))  # JetBrains Mono</span>
              </div>
            </div>
          </Section>

          <Section id="buttons" title="Buttons">
            <Row label="Variants">
              <Button>Default</Button>
              <Button variant="brand">Brand</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">
                <Trash2 data-icon="inline-start" />
                Destructive
              </Button>
              <Button variant="link">Link</Button>
              <Button variant="glass">Glass</Button>
            </Row>
            <Row label="Sizes">
              <Button size="xs">XS</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="xl" variant="brand">
                Extra large
              </Button>
            </Row>
            <Row label="States & icons">
              <Button disabled>Disabled</Button>
              <Button disabled>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Saving
              </Button>
              <Button size="icon" variant="outline" aria-label="Add">
                <Plus />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Settings">
                <Settings />
              </Button>
            </Row>
          </Section>

          <Section id="chips" title="Chips">
            <Row label="Tones">
              {(["neutral", "accent", "ok", "warn", "err", "info", "inverse"] as const).map((t) => (
                <Chip key={t} tone={t} dot>
                  {t}
                </Chip>
              ))}
            </Row>
            <Row label="Stages">
              {STAGE_ORDER.map((s) => (
                <StageChip key={s} stage={s} size="sm" />
              ))}
            </Row>
            <Row label="Deltas">
              <DeltaChip value={24.4} />
              <DeltaChip value={-13} />
              <DeltaChip value={0} />
              <DeltaChip value={-8} goodDirection="down" />
            </Row>
          </Section>

          <Section id="forms" title="Forms">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="k-input">Input</Label>
                <Input id="k-input" placeholder="Placeholder" />
                <Label htmlFor="k-invalid" className="mt-3">
                  Invalid
                </Label>
                <Input id="k-invalid" aria-invalid defaultValue="not-an-email" />
                <Label htmlFor="k-text" className="mt-3">
                  Textarea
                </Label>
                <Textarea id="k-text" rows={3} placeholder="Write a few sentences" />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Select</Label>
                  <Select defaultValue="en">
                    <SelectTrigger className="w-full max-w-xs" aria-label="Language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="k-check" defaultChecked />
                  <Label htmlFor="k-check">Checkbox</Label>
                </div>
                <RadioGroup defaultValue="a" className="flex gap-4" aria-label="Radio group">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="a" id="k-ra" />
                    <Label htmlFor="k-ra">Option A</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="b" id="k-rb" />
                    <Label htmlFor="k-rb">Option B</Label>
                  </div>
                </RadioGroup>
                <div className="flex items-center gap-3">
                  <Switch id="k-switch" defaultChecked />
                  <Label htmlFor="k-switch">Switch</Label>
                </div>
                <Slider defaultValue={[40]} max={100} step={5} aria-label="Slider" className="max-w-xs" />
                <SegmentedDemo />
              </div>
            </div>
          </Section>

          <Section id="surfaces" title="Surfaces">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Surface>Surface · default</Surface>
              <Surface tone="accent">Surface · accent</Surface>
              <Surface tone="plum">Surface · plum</Surface>
              <Surface hover>Surface · hover lift</Surface>
            </div>
            <div className="relative overflow-hidden rounded-card-lg bg-[radial-gradient(circle_at_20%_20%,var(--accent),transparent_55%),radial-gradient(circle_at_80%_70%,var(--coral),transparent_50%),var(--panel2)] p-8">
              <GlassCard className="max-w-sm">
                <div className="font-semibold">GlassCard</div>
                <p className="mt-1 text-sm text-ink-muted">Accent material for nav, sidebar, tutor dock and hero cards only.</p>
              </GlassCard>
            </div>
          </Section>

          <Section id="stats" title="Stats & progress">
            <KpiRow>
              <StatTile icon={<Users />} value="345" label="Total learners" delta={{ value: 24.4 }} />
              <StatTile icon={<BookOpenCheck />} value="72%" label="Completion" hint="Healthy ≥ 70%" status="healthy" />
              <StatTile icon={<ShieldCheck />} value="96%" label="Gate pass, first try" hint="Red flag > 95%" status="red-flag" />
              <StatTile icon={<Clock3 />} value="+38%" label="Time vs estimate" hint="Watch: ±20%" status="watch" sparkline={[3, 5, 4, 7, 6, 9, 8]} />
            </KpiRow>
            <Row label="Rings & bars">
              <ProgressRing value={0.25} />
              <ProgressRing value={0.6} tone="ok" size={72} />
              <ProgressRing value={0.9} tone="coral" size={80} label="9/10" />
              <div className="flex w-64 flex-col gap-3">
                <ProgressBar value={0.4} />
                <ProgressBar value={0.75} tone="ok" size="sm" />
                <ProgressBar value={0.2} tone="amber" size="sm" />
              </div>
            </Row>
          </Section>

          <Section id="tickers" title="Tickers">
            <Row label="NumberTicker (rolls when scrolled into view and when the value changes)">
              <span className="text-4xl font-semibold tracking-tight">
                <NumberTicker value={tickerValue} />
              </span>
              <span className="text-4xl font-semibold tracking-tight text-brand-ink">
                <NumberTicker value={87.6} format={{ maximumFractionDigits: 1 }} suffix="%" />
              </span>
              <span className="text-4xl font-semibold tracking-tight text-ok">
                <NumberTicker value={12480} prefix="+" />
              </span>
              <Button variant="outline" size="sm" onClick={() => setTickerValue(Math.round(Math.random() * 9999))}>
                Roll a new value
              </Button>
            </Row>
            <TickerTape
              label="Example ticker"
              pauseLabel="Pause scrolling"
              playLabel="Resume scrolling"
              lead={<Chip tone="accent" size="sm">Ticker tape</Chip>}
              items={["Worked examples", "Retrieval practice", "Spaced repetition", "Interleaving", "Mastery learning"].map(
                (m) => ({ id: m, content: <span>{m}</span> }),
              )}
            />
          </Section>

          <Section id="stages" title="Stages">
            <Row label="StageDots">
              <StageDots
                included={["hook", "explainer", "worked", "guided", "gate", "reflection", "review"]}
                states={{ hook: "done", explainer: "done", worked: "done", guided: "current" }}
              />
              <StageDots included={["hook", "explainer", "worked", "guided", "lab", "gate", "reflection", "review"]} states={{ project: "not_in_v1" }} />
            </Row>
            <Surface className="max-w-xs">
              <TopicRail
                label="Topics"
                items={[
                  { id: "hook", stage: "hook", label: "The problem this module solves", state: "done", minutes: 3 },
                  { id: "explainer", stage: "explainer", label: "The core ideas", sublabel: "1.1 First idea · 1.2 Second idea", state: "done", minutes: 21 },
                  { id: "worked", stage: "worked", label: "Watch a full example", state: "current", minutes: 24 },
                  { id: "guided", stage: "guided", label: "Build it yourself, step by step", state: "todo", minutes: 25 },
                  { id: "review", stage: "review", label: "Lock it in", state: "todo", minutes: 5 },
                  { id: "final", stage: "gate", label: "Final check", state: "locked", minutes: 15 },
                ]}
              />
            </Surface>
          </Section>

          <Section id="learning" title="Learning items">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Surface pad="lg">
                <McQuestion
                  id="k-mc"
                  stem="What is the value of 10 / 3 in Python 3?"
                  options={[
                    { id: "a", text: "3", correct: false, rationale: "Integer division uses //." },
                    { id: "b", text: "3.333...", correct: true, rationale: "/ always returns a float." },
                    { id: "c", text: "Error", correct: false, rationale: "Dividing by a non-zero int is valid." },
                  ]}
                />
              </Surface>
              <Surface pad="lg" className="flex flex-col gap-5">
                <FillQuestion
                  id="k-fill"
                  stem="What type is 3.14?"
                  answers={["float"]}
                  feedbackCorrect="Decimal point means float."
                  feedbackWrong="Look for the decimal point."
                />
                <TieredHints hints={["Look at the punctuation.", "A dot inside a number matters.", "It is a float."]} />
              </Surface>
              <Surface pad="lg">
                <MatchQuestion
                  id="k-match"
                  stem="Match each value to its type."
                  pairs={[
                    { left: "42", right: "int" },
                    { left: '"42"', right: "str" },
                    { left: "4.2", right: "float" },
                  ]}
                />
              </Surface>
              <Surface pad="lg" className="flex flex-col gap-3">
                <Feedback ok title="Correct">Division with / always returns a float.</Feedback>
                <Feedback ok={false} title="Not yet">Quotes make it a str. Remove them and try again.</Feedback>
                <CodeBlock code={'age = 25\nprint(type(age))'} output="<class 'int'>" />
              </Surface>
            </div>
            <Surface pad="md" className="flex flex-col gap-2">
              <PipelineDiagram pipeline={DEMO_PIPELINE} label="Demo workflow: form trigger, filter, two actions" />
              <p className="text-sm text-ink-muted">PipelineDiagram: node states idle, running, ok and error; edges follow their state.</p>
            </Surface>
          </Section>

          <Section id="overlays" title="Overlays">
            <Row label="Triggers">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit with unanswered questions?</DialogTitle>
                    <DialogDescription>2 questions have no answer. They will be marked incorrect.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Keep answering</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button>Submit anyway</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Message learner</SheetTitle>
                    <SheetDescription>Drawers hold secondary tasks without leaving the page.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Bell data-icon="inline-start" />
                    Popover
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="text-sm">3 reviews are due today.</PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>Short, helpful label</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Menu
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => toast.success("Progress saved")}>
                Toast
              </Button>
            </Row>
          </Section>

          <Section id="data" title="Table & states">
            <Surface pad="none" className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-panel-2/60 hover:bg-panel-2/60">
                    <TableHead className="pl-5">Learner</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="pr-5 text-right">Days idle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Jane Cooper", "Loops", "guided", 1],
                    ["Esther Howard", "Functions", "gate", 9],
                    ["Robert Fox", "Conditionals", "explainer", 3],
                  ].map(([n, m, s, d]) => (
                    <TableRow key={n as string}>
                      <TableCell className="pl-5">
                        <span className="flex items-center gap-2.5">
                          <UserAvatar user={{ name: n as string, email: "" }} className="size-7 text-xs" />
                          {n}
                        </span>
                      </TableCell>
                      <TableCell>{m}</TableCell>
                      <TableCell>
                        <StageChip stage={s as "guided"} size="sm" />
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">
                        {(d as number) > 7 ? <Chip size="sm" tone="err">{d}</Chip> : d}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Surface>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <EmptyState icon={<GraduationCap />} title="No courses yet" description="Assigned courses appear here." action={<Button size="sm">Browse catalog</Button>} />
              <ErrorState title="Could not load progress" description="Check your connection and try again." action={<Button size="sm" variant="outline">Retry</Button>} />
              <CardSkeleton />
            </div>
          </Section>

          <Section id="composites" title="Composites">
            {course ? (
              <>
                <ResumeCard course={course} progress={deriveProgress(course, {})} />
                <ProgramCard course={course} />
              </>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CredentialCard credential={credential} />
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-24 flex-col gap-5">
      <h2 id={`${id}-h`} className="border-b border-line pb-2 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium tracking-wide text-ink-faint uppercase">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function SwatchGroup({ title, vars }: { title: string; vars: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium tracking-wide text-ink-faint uppercase">{title}</div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {vars.map((v) => (
          <li key={v} className="flex flex-col gap-1.5">
            <span className="h-12 rounded-lg border border-line shadow-sm" style={{ background: `var(${v})` }} />
            <code className="truncate font-mono text-xs text-ink-muted">{v}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SegmentedDemo() {
  const [v, setV] = React.useState<"12m" | "3m" | "30d" | "7d">("12m");
  return (
    <Segmented
      aria-label="Range"
      value={v}
      onValueChange={setV}
      options={[
        { value: "12m", label: "12 months" },
        { value: "3m", label: "3 months" },
        { value: "30d", label: "30 days" },
        { value: "7d", label: "7 days" },
      ]}
    />
  );
}
