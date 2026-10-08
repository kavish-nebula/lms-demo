/**
 * MOCK. Stands in for the server-side capstone grader: the hidden test rows
 * and what each requirement expects live here, never in the UI data. It runs
 * the learner's sandbox workflow against fresh test data and explains every
 * miss. Delete when the grading API exists.
 */
import { REJECT_SHEET } from "@/lib/sandbox/nodes";
import { firesOnNewRow, reachable, simulate } from "@/lib/sandbox/run";
import type { Execution, Fault, Json, TriggerEvent, Workflow, World } from "@/lib/sandbox/types";

export type RequirementId = "trigger" | "normalise" | "reject" | "dedupe" | "write" | "alert" | "resilience" | "hygiene";

export type RequirementResult = { id: RequirementId; passed: boolean; details: string[]; hint: string };

export type LaunchSummary = { rows: number; rejected: number; duplicates: number; written: number; alerts: number; retried: number };

export type CapstoneReport = {
  at: string;
  results: RequirementResult[];
  passed: number;
  total: number;
  accepted: boolean;
  /** the accepted workflow run on launch hour: 400 sign-ups */
  launch?: LaunchSummary;
};

const HINTS: Record<RequirementId, string> = {
  trigger:
    "Use one Google Sheets Trigger on the Launch sign-ups document, sheet Form responses, Trigger On: Row Added. Row Updated would miss new sign-ups, and two triggers would run every row twice.",
  normalise:
    "Put an Edit Fields node right after the trigger and set email, fullName, plan and signupDate there. Trim and lower-case the email, trim the name, lower-case the plan and fall back to \"starter\" when it is blank, and turn the three date formats into yyyy-MM-dd (the expression from Module 2's cleaning pipeline works here).",
  reject:
    "Send rows without a usable email down a separate branch: an If node whose false output appends the row to Rejected sign-ups with a Reason. \"is not empty\" alone is not enough: \"nadia@\" is not empty either. Check the cleaned email with matches regex, or with {{ $json.email.isEmail() }}.",
  dedupe:
    "Each sign-up is its own execution, so Remove Duplicates must remember earlier runs: Operation \"Remove Items Processed in Previous Executions\", Value to Dedupe On the cleaned email. Put it after the normalising step, so the cleaned emails are compared.",
  write:
    "Only rows that passed both guards should reach HubSpot (Create or Update contact), with Email, Full Name, Plan and Sign-up Date mapped from the cleaned fields. Junk that reaches HubSpot comes back as a 400 error.",
  alert:
    "Put the Slack node for #new-leads after HubSpot, not beside it, and include the person's name, email and plan in the message. After HubSpot, $json is the contact HubSpot returned: it carries fullName, email and plan.",
  resilience:
    "Open HubSpot's Settings tab. Turn on Retry On Fail so a 429 is tried again, and set On Error to \"Continue (using error output)\". Then connect the error output to a Slack message in #ops-alerts that names the email, so an outage is reported instead of lost.",
  hygiene:
    "Give the workflow a name a teammate would understand (not \"My workflow\"), keep keys and tokens out of node fields (the credentials are already set up), and delete or connect any node that nothing runs into.",
};

/* ---------------------------------------------------------------- hidden test rows */

type Row = { name: string; email: string; plan: string; date: string };
const row = (r: Row, utm = "launch-email"): Json => ({
  "Full name": r.name,
  "Email address": r.email,
  Plan: r.plan,
  "Signed up on": r.date,
  utm_source: utm,
});
const ev = (r: Row, fault?: Fault): TriggerEvent => ({ row: row(r), fault });

type Expect = { email: string; fullName: string; plan: string; signupDate: string };
const CLEAN: { row: Row; expect: Expect }[] = [
  {
    row: { name: "Maya Patel", email: "maya@quill.so", plan: "pro", date: "2026-04-02" },
    expect: { email: "maya@quill.so", fullName: "Maya Patel", plan: "pro", signupDate: "2026-04-02" },
  },
  {
    row: { name: "  Diego Ramos  ", email: "\tDiego.Ramos@Brightline.IO ", plan: " Team ", date: "02/04/2026" },
    expect: { email: "diego.ramos@brightline.io", fullName: "Diego Ramos", plan: "team", signupDate: "2026-04-02" },
  },
  {
    row: { name: "Hana Kim", email: "hana.kim@tidal.app", plan: "", date: "April 3, 2026" },
    expect: { email: "hana.kim@tidal.app", fullName: "Hana Kim", plan: "starter", signupDate: "2026-04-03" },
  },
  {
    row: { name: "Sam O'Neil", email: "sam@oneil.dev", plan: "STARTER", date: "2026-04-04T17:45:00Z" },
    expect: { email: "sam@oneil.dev", fullName: "Sam O'Neil", plan: "starter", signupDate: "2026-04-04" },
  },
];

const REJECTS: Row[] = [
  { name: "Rita Gomez", email: "", plan: "pro", date: "2026-04-05" },
  { name: "Ben Ito", email: "    ", plan: "team", date: "2026-04-05" },
  { name: "Nadia Haddad", email: "nadia@", plan: "starter", date: "05/04/2026" },
  { name: "Joe Lund", email: "joe.at.lund.se", plan: "", date: "April 5, 2026" },
];

const OWEN: Row = { name: "Owen Hart", email: "owen@hart.io", plan: "pro", date: "2026-04-06" };
const OWEN_AGAIN: Row = { name: "Owen Hart", email: "Owen@Hart.io", plan: "pro", date: "2026-04-06" };
const IRIS: Row = { name: "Iris Wong", email: "iris@wong.studio", plan: "team", date: "2026-04-06" };
const RAVI: Row = { name: "Ravi Nair", email: "ravi@nair.dev", plan: "pro", date: "2026-04-07" };
const ELENA: Row = { name: "Elena Petrova", email: "elena@petrova.io", plan: "team", date: "2026-04-07" };

/* ---------------------------------------------------------------- helpers */

const lc = (s: string) => s.toLowerCase();
const okWrites = (w: World, run: number) => w.crm.calls.filter((c) => c.run === run && c.ok);
const messages = (w: World, run: number, channel: string) => w.slack.filter((m) => m.run === run && m.channel === channel);
const show = (s: string) => JSON.stringify(s);
const who = (r: Row) => r.name.trim();

function ran(executions: Execution[], run: number) {
  const e = executions[run - 1];
  if (!e || e.status === "skipped") return "nothing ran: no trigger reacted to the new row";
  if (e.status === "error" && e.error) return `the run stopped with an error: ${e.error.message}`;
  return null;
}

/* ---------------------------------------------------------------- grading */

export function gradeCapstone(wf: Workflow): CapstoneReport {
  const details: Record<RequirementId, string[]> = {
    trigger: [],
    normalise: [],
    reject: [],
    dedupe: [],
    write: [],
    alert: [],
    resilience: [],
    hygiene: [],
  };

  // 1. trigger
  const sheetTriggers = wf.nodes.filter((n) => n.type === "sheetsTrigger");
  const firing = wf.nodes.filter(firesOnNewRow);
  if (!sheetTriggers.length) details.trigger.push("There is no Google Sheets Trigger, so new sign-ups never start the workflow.");
  else if (!firing.length) {
    const t = sheetTriggers[0]!;
    if (t.params.document !== "Launch sign-ups" || t.params.sheet !== "Form responses")
      details.trigger.push("The Google Sheets Trigger is not watching Launch sign-ups › Form responses.");
    else details.trigger.push(`Trigger On is "${t.params.event === "rowUpdated" ? "Row Updated" : t.params.event}", which never fires for a new sign-up.`);
  } else if (firing.length > 1) details.trigger.push(`${firing.length} triggers watch the sign-up sheet, so every new row runs ${firing.length} times.`);
  if (wf.nodes.some((n) => (n.type === "scheduleTrigger" || n.type === "webhook") && wf.edges.some((e) => e.source === n.id)))
    details.trigger.push("A Schedule Trigger or Webhook is connected too. Sign-ups come from the sheet, so it starts runs with no sign-up in them.");

  // 2, 5, 6. clean rows: normalised, written once, alerted after the write
  {
    const { world, executions } = simulate(
      wf,
      CLEAN.map((c) => ev(c.row)),
    );
    CLEAN.forEach((c, i) => {
      const run = i + 1;
      const name = who(c.row);
      const why = ran(executions, run);
      const writes = okWrites(world, run);
      if (!writes.length) {
        details.write.push(`${name}: nothing was written to HubSpot${why ? ` (${why})` : ""}.`);
        details.normalise.push(`${name}: could not be checked, the row never reached HubSpot.`);
      } else {
        if (writes.length > 1) details.write.push(`${name}: HubSpot was written ${writes.length} times in one run.`);
        const contact = world.crm.contacts.find((x) => x.email === writes[0]!.email);
        const fields: (keyof Expect)[] = ["email", "fullName", "plan", "signupDate"];
        for (const f of fields) {
          const got = contact?.[f] ?? "";
          if (got !== c.expect[f]) details.normalise.push(`${name}: ${f} reached HubSpot as ${show(got)}; expected ${show(c.expect[f])}.`);
        }
      }
      const alerts = messages(world, run, "#new-leads");
      if (!alerts.length) details.alert.push(`${name}: no message in #new-leads${why ? ` (${why})` : ""}.`);
      else {
        if (alerts.length > 1) details.alert.push(`${name}: ${alerts.length} messages in #new-leads for one sign-up.`);
        const text = lc(alerts[0]!.text);
        const missing = [
          !text.includes(lc(c.expect.fullName)) && "the name",
          !text.includes(c.expect.email) && "the cleaned email",
          !text.includes(c.expect.plan) && "the plan",
        ].filter(Boolean);
        if (missing.length) details.alert.push(`${name}: the #new-leads message is missing ${missing.join(", ")}: ${show(alerts[0]!.text)}.`);
        if (writes.length && alerts[0]!.seq < writes[0]!.seq) details.alert.push(`${name}: sales were alerted before the HubSpot write finished.`);
        if (!writes.length) details.alert.push(`${name}: sales were alerted about a contact that is not in HubSpot.`);
      }
    });
  }

  // 3. rows without a usable email
  {
    const { world, executions } = simulate(
      wf,
      REJECTS.map((r) => ev(r)),
    );
    const logged = world.sheets[REJECT_SHEET] ?? [];
    REJECTS.forEach((r, i) => {
      const run = i + 1;
      const label = `${who(r)} (email ${show(r.email)})`;
      if (okWrites(world, run).length) details.reject.push(`${label} was written to HubSpot.`);
      if (world.crm.calls.some((c) => c.run === run && c.status === 400)) details.write.push(`${label} reached HubSpot and came back as 400 Bad Request.`);
      if (messages(world, run, "#new-leads").length) details.reject.push(`${label} was announced in #new-leads.`);
      const line = logged.find((l) => l._run === run);
      if (!line) {
        const why = ran(executions, run);
        details.reject.push(`${label} was not added to ${REJECT_SHEET}${why ? ` (${why})` : ""}.`);
      } else {
        if (!String(line["Reason"] ?? "").trim()) details.reject.push(`${label}: the ${REJECT_SHEET} row has no Reason.`);
        if (!lc(String(line["Full name"] ?? "")).includes(lc(who(r)))) details.reject.push(`${label}: the ${REJECT_SHEET} row is missing the person's name.`);
      }
    });
  }

  // 4. a double-fired form: the same person twice, a minute apart, then someone new
  {
    const { world, executions } = simulate(wf, [ev(OWEN), ev(OWEN_AGAIN), ev(IRIS)]);
    const owenWrites = world.crm.calls.filter((c) => c.ok && lc(c.email.trim()) === OWEN.email).length;
    const owenAlerts = world.slack.filter((m) => m.channel === "#new-leads" && lc(m.text).includes("owen")).length;
    if (owenWrites > 1) details.dedupe.push(`Owen Hart signed up twice (${show(OWEN.email)}, then ${show(OWEN_AGAIN.email)}) and HubSpot was written ${owenWrites} times.`);
    if (owenAlerts > 1) details.dedupe.push(`Owen Hart was announced ${owenAlerts} times in #new-leads.`);
    if (!owenWrites) details.dedupe.push(`Owen Hart never reached HubSpot${ran(executions, 1) ? ` (${ran(executions, 1)})` : ""}.`);
    if (!okWrites(world, 3).length) details.dedupe.push("Iris Wong, a new person after the repeat, never reached HubSpot: the guard stops too much.");
  }

  // 7. the CRM rate-limits once, then is down
  {
    const { world, executions } = simulate(wf, [ev(RAVI, { crm: "rateLimitOnce" }), ev(ELENA, { crm: "down" })]);
    if (!okWrites(world, 1).length)
      details.resilience.push(`HubSpot answered 429 Too Many Requests for Ravi Nair once, and the row was lost${ran(executions, 1) ? ` (${ran(executions, 1)})` : ""}.`);
    else if (!messages(world, 1, "#new-leads").length) details.resilience.push("Ravi Nair was saved after a retry but never announced in #new-leads.");
    if (messages(world, 2, "#new-leads").length) details.resilience.push("HubSpot was down for Elena Petrova, yet sales were told she is in the CRM.");
    const ops = messages(world, 2, "#ops-alerts");
    if (!ops.length) details.resilience.push(`HubSpot was down for Elena Petrova and nobody was told: no message in #ops-alerts.`);
    else if (!ops.some((m) => lc(m.text).includes(ELENA.email))) details.resilience.push(`The #ops-alerts message does not say whose sign-up failed: ${show(ops[0]!.text)}.`);
  }

  // 8. hygiene
  {
    const name = wf.name.trim();
    if (name.length < 6 || /^(my workflow|untitled|workflow|test)\b/i.test(name)) details.hygiene.push(`The workflow name ${show(name)} doesn't tell a teammate what it does.`);
    const secret = /(bearer\s+[a-z0-9._-]{8,}|xox[bp]-[a-z0-9-]{8,}|sk-[a-z0-9]{12,}|pat-[a-z0-9-]{12,}|api[_-]?key\s*[:=]\s*\S{8,})/i;
    for (const n of wf.nodes) if (secret.test(JSON.stringify(n.params))) details.hygiene.push(`${n.name} has a key or token typed into a field.`);
    const live = reachable(wf);
    for (const n of wf.nodes) if (!live.has(n.id)) details.hygiene.push(`${n.name} is not connected to anything that runs.`);
  }

  // nothing starts a run: one line per requirement instead of one per test row
  if (!firing.length)
    for (const id of ["normalise", "reject", "dedupe", "write", "alert", "resilience"] as const)
      details[id] = ["Not tested yet: no trigger starts a run for a new sign-up (see the first requirement)."];

  const order: RequirementId[] = ["trigger", "normalise", "reject", "dedupe", "write", "alert", "resilience", "hygiene"];
  const results = order.map((id) => ({ id, passed: details[id].length === 0, details: details[id].slice(0, 6), hint: HINTS[id] }));
  const passed = results.filter((r) => r.passed).length;
  const accepted = passed === results.length;
  return { at: new Date().toISOString(), results, passed, total: results.length, accepted, launch: accepted ? launchHour(wf) : undefined };
}

/* ---------------------------------------------------------------- launch hour */

const FIRST = ["Ava", "Liam", "Zoe", "Noah", "Mila", "Ethan", "Aria", "Lucas", "Isla", "Mateo", "Nora", "Kai", "Leah", "Omar", "Ivy", "Jude", "Sana", "Felix", "Tara", "Rafael"];
const LAST = ["Brooks", "Okafor", "Tanaka", "Silva", "Novak", "Reyes", "Haddad", "Larsen", "Mehta", "Quinn", "Duarte", "Sato", "Kowalski", "Byrne", "Adeyemi", "Moreau"];
const DOMAINS = ["quill.so", "tidal.app", "orbit.dev", "brightline.io", "harbor.co"];
const PLANS = ["starter", "pro", "team", ""];

/** 400 sign-ups: 320 people, 32 without a usable email, 48 repeats; six hit a rate limit. */
function launchHour(wf: Workflow): LaunchSummary {
  const people = Array.from({ length: 320 }, (_, i) => {
    const f = FIRST[i % FIRST.length]!;
    const l = LAST[Math.floor(i / FIRST.length) % LAST.length]!;
    const d = 1 + (i % 28);
    return { name: `${f} ${l}`, email: `${lc(f)}.${lc(l)}${i}@${DOMAINS[i % DOMAINS.length]}`, plan: PLANS[i % PLANS.length]!, date: i % 3 === 0 ? `${String(d).padStart(2, "0")}/04/2026` : `2026-04-${String(d).padStart(2, "0")}` };
  });
  const events: TriggerEvent[] = [];
  people.forEach((p, i) => {
    events.push(ev(p, i % 53 === 7 ? { crm: "rateLimitOnce" } : undefined));
    if (i % 20 === 3) events.push(ev({ ...p, email: ` ${p.email.toUpperCase()}` }));
    if (i % 20 === 11) events.push(ev({ ...p, email: `${p.email} ` }));
    if (i % 20 === 17) events.push(ev({ ...p, email: p.email.replace(/^./, (c) => c.toUpperCase()) }));
    if (i % 10 === 5) events.push(ev({ ...p, name: `${p.name} (no email)`, email: i % 20 === 5 ? "" : "   " }));
  });
  const { world, executions } = simulate(wf, events);
  const written = new Set(world.crm.calls.filter((c) => c.ok).map((c) => c.email)).size;
  const rejected = (world.sheets[REJECT_SHEET] ?? []).length;
  const failed = executions.filter((e) => e.status === "error").length;
  return {
    rows: events.length,
    rejected,
    duplicates: events.length - rejected - written - failed,
    written,
    alerts: world.slack.filter((m) => m.channel === "#new-leads").length,
    retried: world.crm.calls.filter((c) => c.status === 429).length,
  };
}

