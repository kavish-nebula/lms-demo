// Builds the guided-practice content for Modules 1 and 2 and their sample CSVs.
// Run from the repo root: node fixtures/scripts/make-guided.mjs
// Writes: fixtures/module-n8n-m1.json (guided block), fixtures/guided-n8n-m2.json,
//         apps/web/public/samples/nebula-leads.csv, apps/web/public/samples/nebula-signups-export.csv
import fs from "node:fs";

const csv = (rows) => rows.map((r) => r.map((v) => (/[",\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n") + "\n";

/* ---------------------------------------------------------------- Module 1 sample: 7 leads, 2 without a usable email */
const M1_HEAD = ["First Name", "Email", "Source", "Submitted At"];
const M1_ROWS = [
  ["Ana", "ana@lumenco.io", "Website", "2026-03-02 09:14"],
  ["Tom", " Tom.Reyes@Northwind.com ", "LinkedIn", "2026-03-02 09:31"],
  ["Wen", "wen@harbor.dev", "Webinar", "2026-03-02 10:05"],
  ["Jonas", "", "Website", "2026-03-02 10:12"],
  ["Priya", "PRIYA@quill.so", "Website", "2026-03-02 10:40"],
  ["Kofi", "   ", "Website", "2026-03-02 11:02"],
  ["Lena", "lena@fischer.design", "Referral", "2026-03-02 11:20"],
];

/* ---------------------------------------------------------------- Module 2 sample: 500 rows -> 459 with email -> 376 unique */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261007);
const pick = (a) => a[Math.floor(rand() * a.length)];
const FIRST = ["Ava", "Liam", "Zoe", "Noah", "Mila", "Ethan", "Aria", "Lucas", "Isla", "Mateo", "Nora", "Kai", "Leah", "Omar", "Ivy", "Jude", "Sana", "Felix", "Tara", "Rafael", "Priya", "Tomás", "Wen", "Ana", "Kofi", "Lena", "Diego", "Hana", "Owen", "Iris"];
const LAST = ["Brooks", "Okafor", "Tanaka", "Silva", "Novak", "Reyes", "Haddad", "Larsen", "Mehta", "Quinn", "Duarte", "Sato", "Kowalski", "Byrne", "Adeyemi", "Moreau", "Shah", "Ortega", "Li", "Souza"];
const DOMAINS = ["quill.so", "tidal.app", "orbit.dev", "brightline.io", "harbor.co", "lumenco.io", "northwind.com"];
const SOURCES = ["Website", "LinkedIn", "Webinar", "Referral"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const dateIn = (d, style) => (style === 0 ? `2026-03-${pad(d)}` : style === 1 ? `${pad(d)}/03/2026` : `${MON[2]} ${d}, 2026`);

const people = [];
for (let i = 0; i < 376; i++) {
  const f = FIRST[i % FIRST.length];
  const l = LAST[Math.floor(i / FIRST.length) % LAST.length];
  const base = `${f.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}.${l.toLowerCase()}${i}@${DOMAINS[i % DOMAINS.length]}`;
  // one in five people typed their email with capitals the first time
  const email = i % 5 === 0 ? base.replace(/^./, (c) => c.toUpperCase()).replace(/@(.)/, (_, c) => `@${c.toUpperCase()}`) : base;
  const plan = pick(["pro", "pro", "team", "free", "PRO", "Pro", " team", ""]);
  people.push({ name: `${f} ${l}`, email, plan, day: 1 + (i % 28), style: i % 3, source: pick(SOURCES) });
}
const rows = people.map((p) => [rand() < 0.15 ? `  ${p.name}` : p.name, rand() < 0.2 ? ` ${p.email} ` : p.email, p.plan, dateIn(p.day, p.style), p.source]);
// 83 repeats from a double import: 40 exact, 43 typed differently (case and spaces)
for (let i = 0; i < 83; i++) {
  const p = people[(i * 7) % people.length];
  const variant = i < 40 ? p.email : i % 2 ? p.email.toUpperCase() : ` ${p.email.toLowerCase()}  `;
  rows.push([p.name, variant, p.plan, dateIn(p.day, (p.style + 1) % 3), p.source]);
}
// 41 rows with no usable email
for (let i = 0; i < 41; i++) rows.push([`${pick(FIRST)} ${pick(LAST)}`, i % 3 === 0 ? "   " : "", pick(["pro", "free", ""]), dateIn(1 + (i % 28), i % 3), pick(SOURCES)]);
// shuffle so repeats and blanks are spread through the export
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const M2_HEAD = ["Full Name", "E-mail", "Plan", "Signed up", "Source"];

// the numbers the guide promises, computed from the data itself
const withEmail = rows.filter((r) => r[1].trim() !== "");
const unique = new Set(withEmail.map((r) => r[1].trim().toLowerCase())).size;
const caseSensitive = new Set(withEmail.map((r) => r[1].trim())).size;
if (rows.length !== 500 || withEmail.length !== 459 || unique !== 376) throw new Error(`counts off: ${rows.length} ${withEmail.length} ${unique}`);

/* ---------------------------------------------------------------- screen helpers */
const node = (id, icon, name, x, y = 45, extra = {}) => ({ id, icon, name, x, y, ...extra });
const M1N = {
  t: (s) => node("t", "sheets", "Google Sheets Trigger", 14, 45, { trigger: true, ...(s ? { status: "ok" } : {}) }),
  set: (s) => node("set", "set", "Edit Fields", 37, 45, s ? { status: "ok" } : {}),
  filter: (s) => node("filter", "filter", "Filter", 60, 45, s ? { status: "ok" } : {}),
  slack: (s) => node("slack", "slack", "Send a message", 83, 45, s ? { status: "ok" } : {}),
};
const M1_NAME = "Lead alerts → #new-leads";
const tbl = (columns, rows, items = rows.length) => ({ items, columns, rows });
const leadsIn = tbl(
  ["First Name", "Email", "Source"],
  M1_ROWS.slice(0, 5).map((r) => [r[0], r[1], r[2]]),
  7,
);
const leadsClean = tbl(
  ["firstName", "email", "source"],
  M1_ROWS.slice(0, 5).map((r) => [r[0], r[1].trim().toLowerCase(), r[2]]),
  7,
);
const leadsKept = tbl(
  ["firstName", "email", "source"],
  M1_ROWS.filter((r) => r[1].trim()).map((r) => [r[0], r[1].trim().toLowerCase(), r[2]]),
);

const m1 = {
  step_id: "m1.guided",
  stage: "guided",
  duration_min: 30,
  bloom: "apply",
  load: "medium",
  objective_ids: ["obj-1.1", "obj-1.2", "obj-1.3"],
  title: "Build the lead alert yourself",
  situation:
    "Monday, 9 AM. The lead form is live again and Ana wants every new lead in Slack within a minute: no empty rows, no shouting capitals, no weekend black holes. This time you build it, in your own n8n, from an empty canvas.",
  intro: "Ten steps in your own n8n. Each one shows the screen you should be looking at, with the exact button or field numbered.",
  goal: {
    view: "canvas",
    name: M1_NAME,
    nodes: [M1N.t(), M1N.set(), M1N.filter(), M1N.slack()],
    edges: [
      { from: "t", to: "set" },
      { from: "set", to: "filter" },
      { from: "filter", to: "slack" },
    ],
    published: true,
    caption: "The finished workflow in n8n: Google Sheets Trigger, Edit Fields, Filter and a Slack message, published.",
  },
  before: {
    items: [
      "An n8n account: an **n8n Cloud** trial, or n8n on your own computer (`npx n8n`, then open http://localhost:5678).",
      "A Google account, for the lead sheet.",
      "A Slack workspace where you can add apps, with a channel called `#new-leads`. A free test workspace is fine.",
      "About 30 minutes. Your progress here is saved, so you can stop between steps.",
    ],
    downloads: [{ label: "nebula-leads.csv", href: "/samples/nebula-leads.csv", note: "7 leads from the form, including 2 without a usable email." }],
  },
  steps: [
    {
      id: "sheet",
      title: "Put the leads in a Google Sheet",
      body: "The trigger watches a sheet, so start with one. The sample has seven leads; two of them have no usable email, which is what the guard will catch.",
      actions: [
        "Download **nebula-leads.csv** (above), then open Google Sheets and create a **Blank spreadsheet**. Name it `Nebula leads`.",
        "Choose **File › Import › Upload** and pick the file. Set **Import location** to **Replace current sheet**.",
        "Untick **Convert text to numbers, dates, and formulas**, then click **Import data**.",
      ],
      screen: {
        view: "sheet",
        title: "Nebula leads",
        tabs: ["Sheet1"],
        tab: "Sheet1",
        columns: M1_HEAD,
        rows: M1_ROWS,
        caption: "Google Sheets with the seven sample leads in Sheet1. Jonas and Kofi have no usable email.",
      },
      check: "Seven leads under a header row: **First Name**, **Email**, **Source**, **Submitted At**. Jonas's email is empty and Kofi's is only spaces.",
      tip: "If the import added a second tab instead of replacing Sheet1, delete the empty tab. The trigger reads whichever tab you choose later.",
    },
    {
      id: "create",
      title: "Create the workflow and name it",
      body: "A clear name is the first thing a teammate sees in the workflow list.",
      actions: ["In n8n, open **Overview** and click **Create Workflow**.", "Click the name **My workflow** at the top left, type `Lead alerts → #new-leads` and press Enter."],
      values: [{ label: "Workflow name", value: M1_NAME }],
      screen: { view: "canvas", name: M1_NAME, nodes: [], edges: [], marks: { name: 2 }, caption: "An empty n8n canvas. The workflow name at the top left is marked 2." },
      check: "An empty canvas with **Add first step** in the middle, and your workflow name at the top.",
    },
    {
      id: "trigger",
      title: "Add the Google Sheets trigger",
      body: "Every workflow starts with a trigger. This one wakes up when a row is added to the sheet: one new lead, one run.",
      actions: ["Click **Add first step**.", "Type `Google Sheets` in the search box.", "Under **Google Sheets Trigger**, choose **On row added**."],
      screen: {
        view: "panel",
        name: M1_NAME,
        title: "What triggers this workflow?",
        search: "google sheets",
        items: [
          { id: "added", icon: "sheets", name: "On row added", desc: "Starts when a row is added", group: "Google Sheets Trigger" },
          { id: "updated", icon: "sheets", name: "On row updated", desc: "Starts when a row changes", group: "Google Sheets Trigger" },
          { id: "both", icon: "sheets", name: "On row added or updated", desc: "Starts on either", group: "Google Sheets Trigger" },
        ],
        nodes: [],
        edges: [],
        marks: { add: 1, search: 2, added: 3 },
        caption: "The trigger panel, searched for Google Sheets. On row added is marked 3.",
      },
      check: "The trigger opens in its own panel, with fields for a credential, a document and a sheet.",
    },
    {
      id: "credential",
      title: "Connect your Google account",
      body: "n8n needs permission to read the sheet. You connect once; later nodes can reuse the credential.",
      actions: [
        "In **Credential to connect with**, choose **Create new credential**.",
        "On n8n Cloud, click **Sign in with Google**, pick your account and allow access.",
        "Close the credential window when it says the account is connected.",
      ],
      screen: {
        view: "credential",
        icon: "sheets",
        title: "Google Sheets Trigger account",
        fields: [
          { id: "using", label: "Connect using", value: "OAuth2 (recommended)" },
          { id: "redirect", label: "OAuth Redirect URL", value: "https://your-instance.app.n8n.cloud/rest/oauth2-credential/callback" },
        ],
        button: "Sign in with Google",
        marks: { button: 2 },
        caption: "The new Google Sheets Trigger credential, with Sign in with Google marked 2.",
      },
      check: "The credential window shows the account as connected, and the trigger's credential field shows the new credential.",
      tip: "Running n8n yourself (npx or Docker)? Google sign-in needs your own OAuth client from Google Cloud. Follow n8n's **Google OAuth2 single service** guide, then paste the Client ID and Client Secret here.",
    },
    {
      id: "point",
      title: "Point the trigger at your sheet",
      body: "Tell the trigger which sheet to watch and how often. Then fetch the rows that are already there, so the next nodes have data to work with.",
      actions: [
        "Set **Poll Times** to **Every Minute**.",
        "For **Document**, choose **From list** and pick `Nebula leads`. For **Sheet**, pick `Sheet1`.",
        "Check **Trigger On** says **Row Added**.",
        "Click **Fetch Test Event**.",
      ],
      screen: {
        view: "ndv",
        icon: "sheets",
        node: "Google Sheets Trigger",
        action: "Fetch Test Event",
        fields: [
          { id: "cred", kind: "select", label: "Credential to connect with", value: "Google Sheets Trigger account" },
          { id: "poll", kind: "select", label: "Poll Times", value: "Every Minute" },
          { id: "doc", kind: "select", label: "Document", value: "From list · Nebula leads" },
          { id: "sheet", kind: "select", label: "Sheet", value: "From list · Sheet1" },
          { id: "event", kind: "select", label: "Trigger On", value: "Row Added" },
        ],
        output: leadsIn,
        marks: { poll: 1, doc: 2, event: 3, action: 4 },
        caption: "The trigger's settings with the fetched rows in the output: 7 items.",
      },
      check: "The output shows **7 items**, one per lead, with First Name, Email, Source and Submitted At.",
      tip: "Nothing in the output? Check the document and sheet names, and that the sheet's first row is the header.",
    },
    {
      id: "clean",
      title: "Clean the fields with Edit Fields",
      body: "Column names with spaces and emails with capitals cause trouble later. Rename and tidy them once, here, so every later node reads clean fields.",
      actions: [
        "Go back to the canvas and click the **+** to the right of the trigger. Search `Edit Fields` and pick **Edit Fields (Set)**.",
        "Leave **Mode** on **Manual Mapping**. Under **Fields to Set**, click **Add Field** three times.",
        "Fill in each field's name, keep the type **String**, and paste its value (below). Typing `{{` switches a field to an expression.",
        "Click **Execute step**.",
      ],
      values: [
        { label: "firstName", value: '{{ $json["First Name"].trim() }}' },
        { label: "email", value: "{{ $json.Email.trim().toLowerCase() }}" },
        { label: "source", value: "{{ $json.Source }}" },
      ],
      screen: {
        view: "ndv",
        icon: "set",
        node: "Edit Fields",
        action: "Execute step",
        fields: [
          { id: "mode", kind: "select", label: "Mode", value: "Manual Mapping" },
          {
            id: "fields",
            kind: "assign",
            label: "Fields to Set",
            rows: [
              { name: "firstName", type: "String", value: '{{ $json["First Name"].trim() }}', result: "Ana" },
              { name: "email", type: "String", value: "{{ $json.Email.trim().toLowerCase() }}", result: "ana@lumenco.io" },
              { name: "source", type: "String", value: "{{ $json.Source }}", result: "Website" },
            ],
          },
        ],
        input: leadsIn,
        output: leadsClean,
        marks: { mode: 2, fields: 3, action: 4 },
        caption: "Edit Fields with three fields set by expressions: raw rows in, clean rows out.",
      },
      check: "The output has **7 items** with only **firstName**, **email** and **source**. Tom's email is now `tom.reyes@northwind.com`, and Jonas's and Kofi's are empty.",
      tip: "An error like *Cannot read properties of undefined* means a column name doesn't match. Compare the spelling and capitals with the input panel on the left.",
    },
    {
      id: "guard",
      title: "Block rows without an email",
      body: "Forms get empty submissions. The Filter checks every item and lets through only the ones that have an email, so nobody gets an alert about nothing.",
      actions: [
        "Click the **+** after Edit Fields, search `Filter` and pick **Filter**.",
        "In the first condition, set the value to `{{ $json.email }}`.",
        "Open the operator menu and choose **String › is not empty**.",
        "Click **Execute step**.",
      ],
      values: [{ label: "Value to check", value: "{{ $json.email }}" }],
      screen: {
        view: "ndv",
        icon: "filter",
        node: "Filter",
        action: "Execute step",
        fields: [{ id: "cond", kind: "condition", label: "Conditions", rows: [{ left: "{{ $json.email }}", op: "is not empty" }] }],
        input: leadsClean,
        output: tbl(["firstName", "email", "source"], leadsKept.rows),
        marks: { cond: 2, action: 4 },
        caption: "The Filter keeps items whose email is not empty: 7 in, 5 out.",
      },
      check: "**5 items** in the output. Jonas and Kofi stop here.",
      tip: "Kofi's email was only spaces. It counts as empty because Edit Fields trimmed it first. That's why cleaning comes before guarding.",
    },
    {
      id: "slack",
      title: "Send the alert to Slack",
      body: "The action is the visible work: one message per clean lead, with the name, email and where they came from.",
      actions: [
        "Click the **+** after the Filter, search `Slack` and pick **Send message**.",
        "In **Credential to connect with**, create a new credential and click **Connect my account**, then allow access.",
        "Set **Send Message To** to **Channel**, and **Channel** to **From list** › `#new-leads`.",
        "Leave **Message Type** on **Simple Text Message** and paste the **Message Text** (below). Click **Execute step**.",
      ],
      values: [{ label: "Message Text", value: "New lead: {{ $json.firstName }} ({{ $json.email }}) from {{ $json.source }}" }],
      screen: {
        view: "ndv",
        icon: "slack",
        node: "Send a message",
        action: "Execute step",
        fields: [
          { id: "cred", kind: "select", label: "Credential to connect with", value: "Slack account" },
          { id: "resource", kind: "select", label: "Resource", value: "Message" },
          { id: "to", kind: "select", label: "Send Message To", value: "Channel" },
          { id: "channel", kind: "select", label: "Channel", value: "From list · #new-leads" },
          { id: "type", kind: "select", label: "Message Type", value: "Simple Text Message" },
          { id: "text", kind: "expr", label: "Message Text", value: "New lead: {{ $json.firstName }} ({{ $json.email }}) from {{ $json.source }}", result: "New lead: Ana (ana@lumenco.io) from Website" },
        ],
        input: tbl(["firstName", "email", "source"], leadsKept.rows),
        marks: { cred: 2, channel: 3, text: 4 },
        caption: "The Slack node sending to #new-leads, with the message built from the cleaned fields.",
      },
      check: "Five messages in `#new-leads`, one per lead, like *New lead: Ana (ana@lumenco.io) from Website*.",
      tip: "Nothing arrives in a private channel? Invite the n8n app there with `/invite @n8n`. Messages end with a link to the workflow. To leave it out, open **Options**, add **Include Link to Workflow** and turn it off.",
    },
    {
      id: "run",
      title: "Run the whole workflow",
      body: "So far you ran one node at a time. Now run it end to end and read the counts on the connections: that's where you see the guard doing its job.",
      actions: ["Close the node panel to get back to the canvas.", "Click **Execute workflow** at the bottom of the canvas."],
      screen: {
        view: "canvas",
        name: M1_NAME,
        nodes: [M1N.t(true), M1N.set(true), M1N.filter(true), M1N.slack(true)],
        edges: [
          { from: "t", to: "set", label: "7 items" },
          { from: "set", to: "filter", label: "7 items" },
          { from: "filter", to: "slack", label: "5 items" },
        ],
        marks: { execute: 2 },
        caption: "The workflow after a run: every node ticked green, with 7, 7 and 5 items on the connections.",
      },
      check: "A green tick on every node and **7 → 7 → 5** items on the connections. Five more messages arrive in Slack.",
      tip: "Every manual run sends the alerts again. That's expected while testing; once it's published, only new rows trigger it.",
    },
    {
      id: "publish",
      title: "Publish it",
      body: "Until you publish, the workflow only runs when you click. Published, it checks the sheet every minute on its own.",
      actions: [
        "Click **Save**, then **Publish** at the top right. Add a short note if n8n asks for one.",
        "Add a new row to the sheet with your own name and email.",
        "Wait a minute, then check `#new-leads`, and the **Executions** tab in n8n.",
      ],
      screen: {
        view: "canvas",
        name: M1_NAME,
        nodes: [M1N.t(), M1N.set(), M1N.filter(), M1N.slack()],
        edges: [
          { from: "t", to: "set" },
          { from: "set", to: "filter" },
          { from: "filter", to: "slack" },
        ],
        marks: { save: 1, publish: 1 },
        caption: "The top right of the editor: Save, then Publish, both marked 1.",
      },
      check: "**Published** at the top right. About a minute after you add a row, its alert appears in `#new-leads`, and the run is listed under **Executions**.",
      tip: "Only rows added after publishing count as new. Older rows don't alert again.",
    },
  ],
  finish: {
    title: "Your lead alert is live",
    body: "You built a real workflow from an empty canvas: a trigger, a cleaning step, a guard and an action, in the order that makes them work.",
    checklist: [
      "Trigger: **Google Sheets Trigger**, Row Added, every minute",
      "Clean: **Edit Fields** renames and tidies before anything reads the data",
      "Guard: **Filter** stops rows without an email",
      "Act: **Slack** posts one alert per clean lead",
    ],
  },
};

/* ---------------------------------------------------------------- Module 2 */
const M2_NAME = "Clean sign-up export → crm_import";
const M2N = {
  t: (s) => node("t", "manual", "When clicking ‘Execute workflow’", 8, 45, { trigger: true, ...(s ? { status: "ok" } : {}) }),
  get: (s) => node("get", "sheets", "Get row(s) in sheet", 24.5, 45, s ? { status: "ok" } : {}),
  set: (s) => node("set", "set", "Edit Fields", 41, 45, s ? { status: "ok" } : {}),
  filter: (s) => node("filter", "filter", "Filter", 57.5, 45, s ? { status: "ok" } : {}),
  dedupe: (s) => node("dedupe", "dedupe", "Remove Duplicates", 74, 45, s ? { status: "ok" } : {}),
  append: (s) => node("append", "sheets", "Append row in sheet", 90.5, 45, s ? { status: "ok" } : {}),
};
const chain = (ids, labels) => ids.slice(1).map((id, i) => ({ from: ids[i], to: id, ...(labels ? { label: labels[i] } : {}) }));
const M2_IDS = ["t", "get", "set", "filter", "dedupe", "append"];
const messy = rows.slice(0, 6);
const rawIn = tbl(["Full Name", "E-mail", "Plan", "Signed up"], messy.map((r) => r.slice(0, 4)), 500);
const DATE_EXPR =
  '{{ [DateTime.fromISO($json["Signed up"]), DateTime.fromFormat($json["Signed up"], "dd/MM/yyyy"), DateTime.fromFormat($json["Signed up"], "MMM d, yyyy")].filter(d => d.isValid).map(d => d.toISODate())[0] }}';
const iso = (s) => {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\w{3}) (\d{1,2}), (\d{4})$/.exec(s);
  return `${m[3]}-${pad(MON.indexOf(m[1]) + 1)}-${pad(+m[2])}`;
};
const cleanRow = (r) => [r[1].trim().toLowerCase(), r[0].trim(), r[2].trim().toLowerCase() || "free", iso(r[3])];
const cleanOut = tbl(["email", "fullName", "plan", "signupDate"], messy.map(cleanRow), 500);
const keptOut = tbl(["email", "fullName", "plan", "signupDate"], rows.filter((r) => r[1].trim()).slice(0, 6).map(cleanRow), 459);
const seen = new Set();
const uniqueRows = rows.filter((r) => r[1].trim()).map(cleanRow).filter((r) => (seen.has(r[0]) ? false : (seen.add(r[0]), true)));
const uniqueOut = tbl(["email", "fullName", "plan", "signupDate"], uniqueRows.slice(0, 6), 376);

const m2 = {
  step_id: "m2.guided",
  stage: "guided",
  duration_min: 35,
  bloom: "apply",
  load: "medium",
  objective_ids: ["obj-2.1", "obj-2.2", "obj-2.3"],
  title: "Build the cleaning pipeline yourself",
  situation:
    "The 500-row export is sitting in a sheet: three date formats, mixed-case emails with stray spaces, repeats from a double import, blank plans. The CRM rejects anything dirty, and Ana needs it loaded by Friday. Build the pipeline that lets only clean, unique rows through.",
  intro: "Eight steps in your own n8n. You'll watch 500 rows become 376, and you'll be able to explain every one that stopped.",
  goal: {
    view: "canvas",
    name: M2_NAME,
    nodes: M2_IDS.map((id) => M2N[id]()),
    edges: chain(M2_IDS),
    caption: "The finished pipeline: a manual trigger, Get row(s) in sheet, Edit Fields, Filter, Remove Duplicates and Append row in sheet.",
  },
  before: {
    items: [
      "Your n8n from Module 1 (n8n Cloud, or `npx n8n` on your computer).",
      "Your Google account. The Google Sheets node uses its own credential, so you'll sign in once more.",
      "About 35 minutes. Your progress here is saved.",
    ],
    downloads: [
      {
        label: "nebula-signups-export.csv",
        href: "/samples/nebula-signups-export.csv",
        note: "500 sign-ups: 41 without an email, 83 repeats, dates in three formats and some blank plans.",
      },
    ],
  },
  steps: [
    {
      id: "sheet",
      title: "Load the export into Google Sheets",
      body: "Two tabs: the messy export, and an empty tab with the four columns the CRM expects. The pipeline reads one and writes the other.",
      actions: [
        "Create a **Blank spreadsheet** named `Nebula sign-ups export`. Choose **File › Import › Upload**, pick the CSV and set **Import location** to **Replace current sheet**.",
        "Untick **Convert text to numbers, dates, and formulas** before **Import data**, so the dates stay exactly as typed.",
        "Rename the tab to `export`. Add a second tab named `crm_import` and type the header row: `email`, `fullName`, `plan`, `signupDate` in A1 to D1.",
      ],
      screen: {
        view: "sheet",
        title: "Nebula sign-ups export",
        tabs: ["export", "crm_import"],
        tab: "export",
        columns: M2_HEAD,
        rows: rows.slice(0, 12),
        marks: { "tab:crm_import": 3 },
        caption: "The export tab in Google Sheets: names with stray spaces, emails in mixed case, dates in three formats, some blank plans.",
      },
      check: "**export** has 500 rows under the header (the last one is row 501). **crm_import** has only its header row.",
      tip: "Dates turned into something else, like 3/1/2026? The import converted them. Delete the tab and import again with the conversion box unticked.",
    },
    {
      id: "manual",
      title: "Start a workflow you run by hand",
      body: "This is a one-off cleanup, not something that reacts to new rows, so a manual trigger is the right start.",
      actions: [
        "Create a new workflow and name it `Clean sign-up export → crm_import`.",
        "Click **Add first step**.",
        "Choose **Trigger manually**.",
      ],
      values: [{ label: "Workflow name", value: M2_NAME }],
      screen: {
        view: "panel",
        name: M2_NAME,
        title: "What triggers this workflow?",
        search: "",
        items: [
          { id: "manual", icon: "manual", name: "Trigger manually", desc: "Runs the flow on clicking a button in n8n" },
          { id: "app", icon: "webhook", name: "On app event", desc: "Runs the flow when something happens in an app like Google Sheets" },
          { id: "schedule", icon: "schedule", name: "On a schedule", desc: "Runs the flow every day, hour, or custom interval" },
          { id: "webhook", icon: "webhook", name: "On webhook call", desc: "Runs the flow on receiving an HTTP request" },
          { id: "form", icon: "form", name: "On form submission", desc: "Generate webforms in n8n and pass their responses to the workflow" },
        ],
        nodes: [],
        edges: [],
        marks: { name: 1, add: 2, manual: 3 },
        caption: "The trigger panel with Trigger manually marked 3.",
      },
      check: "A node called **When clicking ‘Execute workflow’** on the canvas.",
    },
    {
      id: "read",
      title: "Read all 500 rows",
      body: "Get row(s) in sheet with no filters returns every row, one item each. This is the raw material.",
      actions: [
        "Click the **+** after the trigger, search `Google Sheets` and pick **Get row(s) in sheet**.",
        "In **Credential to connect with**, create a new credential and **Sign in with Google**.",
        "Set **Document** to `Nebula sign-ups export` and **Sheet** to `export`. Leave **Filters** empty.",
        "Click **Execute step**.",
      ],
      screen: {
        view: "ndv",
        icon: "sheets",
        node: "Get row(s) in sheet",
        action: "Execute step",
        fields: [
          { id: "cred", kind: "select", label: "Credential to connect with", value: "Google Sheets account" },
          { id: "resource", kind: "select", label: "Resource", value: "Sheet Within Document" },
          { id: "op", kind: "select", label: "Operation", value: "Get Row(s)" },
          { id: "doc", kind: "select", label: "Document", value: "From list · Nebula sign-ups export" },
          { id: "sheet", kind: "select", label: "Sheet", value: "From list · export" },
          { id: "filters", kind: "button", label: "Add Filter" },
        ],
        output: rawIn,
        marks: { cred: 2, doc: 3, action: 4 },
        caption: "Get row(s) in sheet reading the export tab: 500 items, still messy.",
      },
      check: "**500 items** in the output. Scroll through and spot the problems: spaces, capitals, three date formats, blank plans.",
    },
    {
      id: "normalise",
      title: "Normalise every row with Edit Fields",
      body: "Make equal things look equal: one case, no stray spaces, one date format, no blank plans. This is what lets the guards compare values.",
      actions: [
        "Click the **+** after Get row(s) in sheet and add **Edit Fields (Set)**, on **Manual Mapping**.",
        "Add four fields, all **String**, with the names and values below.",
        "Leave **Include Other Input Fields** off, so only these four go on.",
        "Click **Execute step**.",
      ],
      values: [
        { label: "email", value: '{{ $json["E-mail"].trim().toLowerCase() }}' },
        { label: "fullName", value: '{{ $json["Full Name"].trim() }}' },
        { label: "plan", value: '{{ $json.Plan.trim().toLowerCase() || "free" }}' },
        { label: "signupDate", value: DATE_EXPR },
      ],
      screen: {
        view: "ndv",
        icon: "set",
        node: "Edit Fields",
        action: "Execute step",
        fields: [
          {
            id: "fields",
            kind: "assign",
            label: "Fields to Set",
            rows: [
              { name: "email", type: "String", value: '{{ $json["E-mail"].trim().toLowerCase() }}', result: cleanRow(messy[0])[0] },
              { name: "fullName", type: "String", value: '{{ $json["Full Name"].trim() }}', result: cleanRow(messy[0])[1] },
              { name: "plan", type: "String", value: '{{ $json.Plan.trim().toLowerCase() || "free" }}', result: cleanRow(messy[0])[2] },
              { name: "signupDate", type: "String", value: "{{ [DateTime.fromISO(…), DateTime.fromFormat(…)…][0] }}", result: cleanRow(messy[0])[3] },
            ],
          },
          { id: "other", kind: "toggle", label: "Include Other Input Fields", on: false },
        ],
        input: rawIn,
        output: cleanOut,
        marks: { fields: 2, other: 3, action: 4 },
        caption: "Edit Fields turning messy rows into four clean fields: 500 in, 500 out.",
      },
      check: "**500 items**, each with only **email**, **fullName**, **plan** and **signupDate**. Every date looks like `2026-03-14`, and no plan is blank.",
      tip: "The date expression tries each of the three formats and keeps the one that reads as a real date. If a date comes out empty, look at that row in the input panel: it's in a format the expression doesn't list.",
    },
    {
      id: "blank",
      title: "Guard 1: drop rows without an email",
      body: "Now that values are trimmed, an email of only spaces is visibly empty. This guard stops rows the CRM would reject.",
      actions: ["Add a **Filter** after Edit Fields.", "Condition: `{{ $json.email }}` with **String › is not empty**.", "Click **Execute step**."],
      values: [{ label: "Value to check", value: "{{ $json.email }}" }],
      screen: {
        view: "ndv",
        icon: "filter",
        node: "Filter",
        action: "Execute step",
        fields: [{ id: "cond", kind: "condition", label: "Conditions", rows: [{ left: "{{ $json.email }}", op: "is not empty" }] }],
        input: cleanOut,
        output: keptOut,
        marks: { cond: 2, action: 3 },
        caption: "The Filter keeps rows with an email: 500 in, 459 out.",
      },
      check: "**459 items** in the output: 41 rows had no email.",
    },
    {
      id: "dedupe",
      title: "Guard 2: remove the repeats",
      body: "The double import left 83 repeats, some typed differently. Because emails are normalised, the repeats now match exactly.",
      actions: [
        "Click the **+** after the Filter, search `Remove Duplicates` and pick **Remove items repeated within current input**.",
        "Set **Compare** to **Selected Fields** and **Fields To Compare** to `email`.",
        "Click **Execute step**.",
      ],
      values: [{ label: "Fields To Compare", value: "email" }],
      screen: {
        view: "ndv",
        icon: "dedupe",
        node: "Remove Duplicates",
        action: "Execute step",
        fields: [
          { id: "op", kind: "select", label: "Operation", value: "Remove Items Repeated Within Current Input" },
          { id: "compare", kind: "select", label: "Compare", value: "Selected Fields" },
          { id: "fields", kind: "text", label: "Fields To Compare", value: "email" },
        ],
        input: keptOut,
        output: uniqueOut,
        marks: { compare: 2, fields: 2, action: 3 },
        caption: "Remove Duplicates comparing the email field: 459 in, 376 out.",
      },
      check: "**376 items**: 83 repeats removed.",
    },
    {
      id: "order",
      title: "See why the order matters",
      body: "Break it on purpose for a minute. Without lower-casing, the same person typed two ways counts as two people, and the duplicate guard can't see it.",
      actions: [
        "Open **Edit Fields** and delete `.toLowerCase()` from the **email** value.",
        "Open **Remove Duplicates** and click **Execute step**. n8n runs the nodes before it too.",
        `Note the count, then put \`.toLowerCase()\` back and click **Execute step** again.`,
      ],
      screen: {
        view: "ndv",
        icon: "dedupe",
        node: "Remove Duplicates",
        action: "Execute step",
        fields: [
          { id: "op", kind: "select", label: "Operation", value: "Remove Items Repeated Within Current Input" },
          { id: "compare", kind: "select", label: "Compare", value: "Selected Fields" },
          { id: "fields", kind: "text", label: "Fields To Compare", value: "email" },
        ],
        input: tbl(["email", "fullName"], keptOut.rows.map((r) => [r[0], r[1]]), 459),
        output: tbl(["email", "fullName"], uniqueOut.rows.map((r) => [r[0], r[1]]), caseSensitive),
        notice: `Without lower-casing: ${caseSensitive} items`,
        marks: { action: 2, output: 3 },
        caption: `Remove Duplicates without lower-cased emails: ${caseSensitive} items instead of 376.`,
      },
      check: `**${caseSensitive} items** without lower-casing, ${caseSensitive - 376} people counted twice. **376** again once it's back.`,
      tip: "This is the module in one line: normalise first, then guard. A guard can only compare what's already clean.",
    },
    {
      id: "write",
      title: "Write the clean rows",
      body: "Only clean, unique rows are left. Append them to the crm_import tab, which is shaped exactly like what the CRM expects.",
      actions: [
        "Click the **+** after Remove Duplicates, search `Google Sheets` and pick **Append row in sheet**.",
        "Use the same credential. Set **Document** to `Nebula sign-ups export` and **Sheet** to `crm_import`.",
        "Set **Mapping Column Mode** to **Map Automatically**: the field names match the header row.",
        "Close the panel and click **Execute workflow**.",
      ],
      screen: {
        view: "canvas",
        name: M2_NAME,
        nodes: M2_IDS.map((id) => M2N[id](true)),
        edges: chain(M2_IDS, ["1 item", "500 items", "500 items", "459 items", "376 items"]),
        marks: { append: 1, execute: 4 },
        caption: "The whole pipeline after a run: 500, 500, 459, 376 items on the connections, and every node green.",
      },
      check: "**500 → 500 → 459 → 376** on the connections, and 376 rows below the header in the **crm_import** tab: lower-case emails, one date format, no blank plans.",
      tip: "Each run appends again. To run it once more, first delete rows 2 and below in crm_import, keeping the header.",
    },
  ],
  finish: {
    title: "500 in, 376 out, and you can explain every one",
    body: "41 rows stopped for having no email, 83 for being repeats, and 376 clean rows are ready for the CRM. You did it in an order you can defend: normalise, guard, guard, write.",
    checklist: [
      "Read: **Get row(s) in sheet** brings in all 500 rows",
      "Normalise: **Edit Fields** with expressions for email, name, plan and date",
      "Guard: **Filter** stops 41 rows without an email",
      "Guard: **Remove Duplicates** on the cleaned email stops 83 repeats",
      "Write: **Append row in sheet** lands 376 clean rows in crm_import",
    ],
  },
};

/* ---------------------------------------------------------------- write */
fs.mkdirSync("apps/web/public/samples", { recursive: true });
fs.writeFileSync("apps/web/public/samples/nebula-leads.csv", csv([M1_HEAD, ...M1_ROWS]));
fs.writeFileSync("apps/web/public/samples/nebula-signups-export.csv", csv([M2_HEAD, ...rows]));

const m1File = "fixtures/module-n8n-m1.json";
const mod = JSON.parse(fs.readFileSync(m1File, "utf8"));
mod.blocks = mod.blocks.map((b) => (b.stage === "guided" ? m1 : b));
fs.writeFileSync(m1File, JSON.stringify(mod, null, 2) + "\n");
fs.writeFileSync("fixtures/guided-n8n-m2.json", JSON.stringify({ course_id: "n8n", module_id: "m2", block: m2 }, null, 2) + "\n");
console.log(`m1 steps ${m1.steps.length}, m2 steps ${m2.steps.length}; m2 rows ${rows.length} -> ${withEmail.length} -> ${unique} (case-sensitive ${caseSensitive})`);
