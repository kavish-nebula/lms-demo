import { evaluate, evaluateText, type Scope } from "./expression";
import type { Assignment, ColumnValue, Condition, Handle, Item, Json, NodeSettings, NodeType, OperatorId, Params, SNode, World } from "./types";

/**
 * Every node the sandbox offers, described the way n8n's editor shows it:
 * the node's name, its parameters (with n8n's labels) and how it behaves on
 * a run. The UI renders parameter forms from `fields`; the runner calls
 * `each` (one item at a time, with retries and error routing), `route`
 * (keep / drop / branch) or `batch` (the whole input at once).
 */

export type IconKey = "sheets" | "schedule" | "webhook" | "set" | "filter" | "if" | "dedupe" | "hubspot" | "slack" | "http" | "wait" | "noop";

export type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  show?: (p: Params) => boolean;
} & (
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "text"; placeholder?: string; multiline?: boolean }
  | { kind: "number"; min?: number }
  | { kind: "toggle" }
  | { kind: "assignments" }
  | { kind: "conditions" }
  | { kind: "columns"; columns: (p: Params) => string[] }
);

/** A node failed on one item; `status` is the HTTP status when an API answered. */
export class NodeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type NodeCtx = { node: SNode; world: World; run: number; fault: { crm?: "rateLimitOnce" | "down" }; scope: (item: Item) => Scope };

export type NodeDef = {
  type: NodeType;
  /** n8n's node name */
  label: string;
  /** what it does, as in the nodes panel */
  description: string;
  group: "trigger" | "data" | "flow" | "app" | "core";
  icon: IconKey;
  defaultName: string;
  trigger?: boolean;
  /** the credential it signs in with, picked from the ones the brief provides */
  credential?: string;
  fields: FieldDef[];
  defaults: () => Params;
  /** outputs besides the error output */
  outputs?: (p: Params) => Handle[];
  each?: (item: Item, ctx: NodeCtx, attempt: number) => Json;
  route?: (item: Item, ctx: NodeCtx) => Handle | null;
  batch?: (items: Item[], ctx: NodeCtx) => Item[];
};

export const DOCUMENT = "Launch sign-ups";
export const SIGNUP_SHEET = "Form responses";
export const REJECT_SHEET = "Rejected sign-ups";
export const SHEET_COLUMNS: Record<string, string[]> = {
  [SIGNUP_SHEET]: ["Full name", "Email address", "Plan", "Signed up on", "utm_source"],
  [REJECT_SHEET]: ["Full name", "Email", "Reason", "Received"],
};
export const CHANNELS = ["#new-leads", "#ops-alerts", "#sales-team", "#general"];

export const OPERATORS: { id: OperatorId; type: "String" | "Number" | "Boolean"; label: string; unary?: boolean }[] = [
  { id: "s.exists", type: "String", label: "exists", unary: true },
  { id: "s.notExists", type: "String", label: "does not exist", unary: true },
  { id: "s.empty", type: "String", label: "is empty", unary: true },
  { id: "s.notEmpty", type: "String", label: "is not empty", unary: true },
  { id: "s.eq", type: "String", label: "is equal to" },
  { id: "s.neq", type: "String", label: "is not equal to" },
  { id: "s.contains", type: "String", label: "contains" },
  { id: "s.notContains", type: "String", label: "does not contain" },
  { id: "s.startsWith", type: "String", label: "starts with" },
  { id: "s.endsWith", type: "String", label: "ends with" },
  { id: "s.regex", type: "String", label: "matches regex" },
  { id: "n.eq", type: "Number", label: "is equal to" },
  { id: "n.gt", type: "Number", label: "is greater than" },
  { id: "n.lt", type: "Number", label: "is less than" },
  { id: "b.true", type: "Boolean", label: "is true", unary: true },
  { id: "b.false", type: "Boolean", label: "is false", unary: true },
];

export const DEFAULT_SETTINGS: NodeSettings = { alwaysOutput: false, retryOnFail: false, maxTries: 3, waitMs: 1000, onError: "stop", notes: "" };

let uid = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

const str = (v: unknown) => (v == null ? "" : String(v));
const p = <T>(params: Params, key: string, fallback: T): T => (params[key] ?? fallback) as T;

function testCondition(c: Condition, scope: Scope, ignoreCase: boolean): boolean {
  const op = OPERATORS.find((o) => o.id === c.op);
  const leftRaw = evaluate(c.left, scope);
  const rightRaw = op?.unary ? "" : evaluate(c.right, scope);
  if (c.op === "s.exists") return leftRaw !== undefined && leftRaw !== null;
  if (c.op === "s.notExists") return leftRaw === undefined || leftRaw === null;
  if (c.op === "b.true") return leftRaw === true || str(leftRaw).toLowerCase() === "true";
  if (c.op === "b.false") return leftRaw === false || str(leftRaw).toLowerCase() === "false";
  if (c.op.startsWith("n.")) {
    const a = Number(leftRaw);
    const b = Number(rightRaw);
    if (Number.isNaN(a) || Number.isNaN(b)) throw new NodeError(`Wrong type: "${str(leftRaw)}" is not a number`);
    return c.op === "n.eq" ? a === b : c.op === "n.gt" ? a > b : a < b;
  }
  let a = str(leftRaw);
  let b = str(rightRaw);
  if (ignoreCase) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  switch (c.op) {
    case "s.empty":
      return a.length === 0;
    case "s.notEmpty":
      return a.length > 0;
    case "s.eq":
      return a === b;
    case "s.neq":
      return a !== b;
    case "s.contains":
      return a.includes(b);
    case "s.notContains":
      return !a.includes(b);
    case "s.startsWith":
      return a.startsWith(b);
    case "s.endsWith":
      return a.endsWith(b);
    case "s.regex": {
      const m = /^\/(.*)\/([a-z]*)$/.exec(b);
      try {
        return new RegExp(m ? m[1]! : b, (m?.[2] ?? "") + (ignoreCase ? "i" : "")).test(a);
      } catch {
        throw new NodeError(`Invalid regex: ${b}`);
      }
    }
  }
  return false;
}

function conditionsPass(params: Params, scope: Scope) {
  const list = p<Condition[]>(params, "conditions", []);
  if (!list.length) return true;
  const ignoreCase = !!params.ignoreCase;
  return params.combinator === "or" ? list.some((c) => testCondition(c, scope, ignoreCase)) : list.every((c) => testCondition(c, scope, ignoreCase));
}

const conditionFields: FieldDef[] = [
  { key: "conditions", label: "Conditions", kind: "conditions" },
  {
    key: "combinator",
    label: "Combine conditions",
    kind: "select",
    options: [
      { value: "and", label: "AND" },
      { value: "or", label: "OR" },
    ],
  },
  { key: "ignoreCase", label: "Ignore Case", kind: "toggle" },
];

const credentialField = (name: string): FieldDef => ({ key: "credential", label: "Credential to connect with", kind: "select", options: [{ value: name, label: name }] });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NODES: Record<NodeType, NodeDef> = {
  sheetsTrigger: {
    type: "sheetsTrigger",
    label: "Google Sheets Trigger",
    description: "Starts the workflow when rows are added or updated in a sheet",
    group: "trigger",
    icon: "sheets",
    defaultName: "Google Sheets Trigger",
    trigger: true,
    credential: "Nebula Google",
    fields: [
      credentialField("Nebula Google"),
      { key: "pollTimes", label: "Poll Times", kind: "select", options: [{ value: "everyMinute", label: "Every Minute" }] },
      { key: "document", label: "Document", kind: "select", options: [{ value: "", label: "Choose…" }, { value: DOCUMENT, label: DOCUMENT }] },
      {
        key: "sheet",
        label: "Sheet",
        kind: "select",
        options: [{ value: "", label: "Choose…" }, ...Object.keys(SHEET_COLUMNS).map((s) => ({ value: s, label: s }))],
      },
      {
        key: "event",
        label: "Trigger On",
        kind: "select",
        options: [
          { value: "rowAdded", label: "Row Added" },
          { value: "rowUpdated", label: "Row Updated" },
          { value: "rowAddedOrUpdated", label: "Row Added or Updated" },
        ],
      },
    ],
    defaults: () => ({ credential: "Nebula Google", pollTimes: "everyMinute", document: "", sheet: "", event: "rowAdded" }),
  },
  scheduleTrigger: {
    type: "scheduleTrigger",
    label: "Schedule Trigger",
    description: "Runs the workflow at fixed times or intervals",
    group: "trigger",
    icon: "schedule",
    defaultName: "Schedule Trigger",
    trigger: true,
    fields: [{ key: "interval", label: "Trigger Interval", kind: "select", options: [{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }] }],
    defaults: () => ({ interval: "hours" }),
  },
  webhook: {
    type: "webhook",
    label: "Webhook",
    description: "Starts the workflow when a URL is called",
    group: "trigger",
    icon: "webhook",
    defaultName: "Webhook",
    trigger: true,
    fields: [
      { key: "method", label: "HTTP Method", kind: "select", options: [{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }] },
      { key: "path", label: "Path", kind: "text", placeholder: "signup" },
    ],
    defaults: () => ({ method: "POST", path: "" }),
  },
  set: {
    type: "set",
    label: "Edit Fields (Set)",
    description: "Modify, add or remove item fields",
    group: "data",
    icon: "set",
    defaultName: "Edit Fields",
    fields: [
      { key: "mode", label: "Mode", kind: "select", options: [{ value: "manual", label: "Manual Mapping" }] },
      { key: "assignments", label: "Fields to Set", kind: "assignments" },
      { key: "includeOther", label: "Include Other Input Fields", kind: "toggle", hint: "Off: the output has only the fields set here" },
    ],
    defaults: () => ({ mode: "manual", assignments: [] as Assignment[], includeOther: false }),
    each(item, ctx) {
      const out: Json = ctx.node.params.includeOther ? { ...item.json } : {};
      for (const a of p<Assignment[]>(ctx.node.params, "assignments", [])) {
        if (!a.name.trim()) continue;
        const v = evaluate(a.value, ctx.scope(item));
        if (a.type === "number") {
          const n = Number(v);
          if (v !== "" && Number.isNaN(n)) throw new NodeError(`"${a.name}" can't be converted to a number: "${str(v)}"`);
          out[a.name] = v === "" ? null : n;
        } else if (a.type === "boolean") out[a.name] = v === true || str(v).toLowerCase() === "true";
        else out[a.name] = typeof v === "string" ? v : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      }
      return out;
    },
  },
  filter: {
    type: "filter",
    label: "Filter",
    description: "Remove items matching a condition",
    group: "flow",
    icon: "filter",
    defaultName: "Filter",
    fields: conditionFields,
    defaults: () => ({ conditions: [] as Condition[], combinator: "and", ignoreCase: false }),
    route: (item, ctx) => (conditionsPass(ctx.node.params, ctx.scope(item)) ? "main" : null),
  },
  if: {
    type: "if",
    label: "If",
    description: "Route items to different branches (true/false)",
    group: "flow",
    icon: "if",
    defaultName: "If",
    fields: conditionFields,
    defaults: () => ({ conditions: [] as Condition[], combinator: "and", ignoreCase: false }),
    outputs: () => ["true", "false"],
    route: (item, ctx) => (conditionsPass(ctx.node.params, ctx.scope(item)) ? "true" : "false"),
  },
  removeDuplicates: {
    type: "removeDuplicates",
    label: "Remove Duplicates",
    description: "Delete items with matching field values",
    group: "flow",
    icon: "dedupe",
    defaultName: "Remove Duplicates",
    fields: [
      {
        key: "operation",
        label: "Operation",
        kind: "select",
        options: [
          { value: "withinInput", label: "Remove Items Repeated Within Current Input" },
          { value: "previousExecutions", label: "Remove Items Processed in Previous Executions" },
        ],
      },
      {
        key: "compare",
        label: "Compare",
        kind: "select",
        options: [
          { value: "all", label: "All Fields" },
          { value: "selected", label: "Selected Fields" },
        ],
        show: (q) => q.operation !== "previousExecutions",
      },
      {
        key: "fields",
        label: "Fields To Compare",
        kind: "text",
        placeholder: "email",
        hint: "Field names, separated by commas",
        show: (q) => q.operation !== "previousExecutions" && q.compare === "selected",
      },
      {
        key: "keep",
        label: "Keep Items Where",
        kind: "select",
        options: [{ value: "new", label: "Value Is New" }],
        show: (q) => q.operation === "previousExecutions",
      },
      { key: "dedupeValue", label: "Value to Dedupe On", kind: "text", placeholder: "{{ $json.email }}", show: (q) => q.operation === "previousExecutions" },
    ],
    defaults: () => ({ operation: "withinInput", compare: "all", fields: "", keep: "new", dedupeValue: "" }),
    batch(items, ctx) {
      const prm = ctx.node.params;
      if (prm.operation === "previousExecutions") {
        const seen = (ctx.world.dedupe[ctx.node.id] ??= []);
        return items.filter((it) => {
          const v = evaluateText(prm.dedupeValue, ctx.scope(it));
          if (!v) throw new NodeError("Value to Dedupe On is empty for an item");
          if (seen.includes(v)) return false;
          seen.push(v);
          return true;
        });
      }
      const keys = prm.compare === "selected" ? str(prm.fields).split(",").map((f) => f.trim()).filter(Boolean) : null;
      if (keys && !keys.length) throw new NodeError("Fields To Compare is empty");
      const seen = new Set<string>();
      return items.filter((it) => {
        const k = JSON.stringify(keys ? keys.map((f) => it.json[f]) : it.json);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
  },
  hubspot: {
    type: "hubspot",
    label: "HubSpot",
    description: "Create or update a contact in the CRM",
    group: "app",
    icon: "hubspot",
    defaultName: "HubSpot",
    credential: "Nebula HubSpot",
    fields: [
      credentialField("Nebula HubSpot"),
      { key: "resource", label: "Resource", kind: "select", options: [{ value: "contact", label: "Contact" }] },
      { key: "operation", label: "Operation", kind: "select", options: [{ value: "upsert", label: "Create or Update" }] },
      { key: "email", label: "Email", kind: "text", placeholder: "{{ $json.email }}" },
      { key: "fullName", label: "Full Name", kind: "text" },
      { key: "plan", label: "Plan", kind: "text" },
      { key: "signupDate", label: "Sign-up Date", kind: "text" },
    ],
    defaults: () => ({ credential: "Nebula HubSpot", resource: "contact", operation: "upsert", email: "", fullName: "", plan: "", signupDate: "" }),
    each(item, ctx, attempt) {
      const sc = ctx.scope(item);
      const email = evaluateText(ctx.node.params.email, sc);
      const call = (ok: boolean, status: number) => ctx.world.crm.calls.push({ email, ok, status, seq: ++ctx.world.seq, run: ctx.run });
      if (ctx.fault.crm === "down") {
        call(false, 503);
        throw new NodeError("HubSpot: 503 Service Unavailable. The service is down, try again later", 503);
      }
      if (ctx.fault.crm === "rateLimitOnce" && attempt === 1) {
        call(false, 429);
        throw new NodeError("HubSpot: 429 Too Many Requests. Rate limit reached", 429);
      }
      if (!email) {
        call(false, 400);
        throw new NodeError("HubSpot: 400 Bad Request. Email is required", 400);
      }
      if (!EMAIL.test(email)) {
        call(false, 400);
        throw new NodeError(`HubSpot: 400 Bad Request. "${email}" is not a valid email address`, 400);
      }
      const fields = {
        fullName: evaluateText(ctx.node.params.fullName, sc),
        plan: evaluateText(ctx.node.params.plan, sc),
        signupDate: evaluateText(ctx.node.params.signupDate, sc),
      };
      call(true, 200);
      let contact = ctx.world.crm.contacts.find((c) => c.email === email);
      if (contact) Object.assign(contact, fields, { writes: contact.writes + 1 });
      else {
        contact = { id: `${1000 + ctx.world.crm.contacts.length + 1}`, email, ...fields, writes: 1 };
        ctx.world.crm.contacts.push(contact);
      }
      return { id: contact.id, email, ...fields, isNew: contact.writes === 1 };
    },
  },
  slack: {
    type: "slack",
    label: "Slack",
    description: "Send a message to a channel",
    group: "app",
    icon: "slack",
    defaultName: "Slack",
    credential: "Nebula Slack",
    fields: [
      credentialField("Nebula Slack"),
      { key: "resource", label: "Resource", kind: "select", options: [{ value: "message", label: "Message" }] },
      { key: "operation", label: "Operation", kind: "select", options: [{ value: "send", label: "Send" }] },
      { key: "sendTo", label: "Send Message To", kind: "select", options: [{ value: "channel", label: "Channel" }] },
      { key: "channel", label: "Channel", kind: "select", options: [{ value: "", label: "Choose…" }, ...CHANNELS.map((c) => ({ value: c, label: c }))] },
      { key: "text", label: "Message Text", kind: "text", multiline: true },
    ],
    defaults: () => ({ credential: "Nebula Slack", resource: "message", operation: "send", sendTo: "channel", channel: "", text: "" }),
    each(item, ctx) {
      const channel = str(ctx.node.params.channel);
      if (!channel) throw new NodeError("Channel is required");
      const text = evaluateText(ctx.node.params.text, ctx.scope(item));
      if (!text.trim()) throw new NodeError("Message Text is empty");
      ctx.world.slack.push({ channel, text, seq: ++ctx.world.seq, run: ctx.run });
      return { ok: true, channel, ts: `${1760000000 + ctx.world.seq}.000100`, message: { text } };
    },
  },
  sheetsAppend: {
    type: "sheetsAppend",
    label: "Google Sheets",
    description: "Append a row to a sheet",
    group: "app",
    icon: "sheets",
    defaultName: "Append row in sheet",
    credential: "Nebula Google",
    fields: [
      credentialField("Nebula Google"),
      { key: "operation", label: "Operation", kind: "select", options: [{ value: "append", label: "Append Row" }] },
      { key: "document", label: "Document", kind: "select", options: [{ value: "", label: "Choose…" }, { value: DOCUMENT, label: DOCUMENT }] },
      {
        key: "sheet",
        label: "Sheet",
        kind: "select",
        options: [{ value: "", label: "Choose…" }, ...Object.keys(SHEET_COLUMNS).map((s) => ({ value: s, label: s }))],
      },
      { key: "columns", label: "Values to Send", kind: "columns", columns: (q) => SHEET_COLUMNS[str(q.sheet)] ?? [] },
    ],
    defaults: () => ({ credential: "Nebula Google", operation: "append", document: "", sheet: "", columns: [] as ColumnValue[] }),
    each(item, ctx) {
      const sheet = str(ctx.node.params.sheet);
      if (!ctx.node.params.document || !sheet) throw new NodeError("Choose a document and a sheet");
      const cols = SHEET_COLUMNS[sheet] ?? [];
      const values = p<ColumnValue[]>(ctx.node.params, "columns", []);
      const row: Json = {};
      for (const c of cols) row[c] = evaluateText(values.find((v) => v.column === c)?.value ?? "", ctx.scope(item));
      (ctx.world.sheets[sheet] ??= []).push({ ...row, _run: ctx.run });
      return row;
    },
  },
  http: {
    type: "http",
    label: "HTTP Request",
    description: "Make an HTTP request and return the response",
    group: "core",
    icon: "http",
    defaultName: "HTTP Request",
    fields: [
      { key: "method", label: "Method", kind: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m })) },
      { key: "url", label: "URL", kind: "text", placeholder: "https://" },
      { key: "headerName", label: "Header Name", kind: "text", placeholder: "Authorization" },
      { key: "headerValue", label: "Header Value", kind: "text" },
      { key: "body", label: "Body (JSON)", kind: "text", multiline: true },
    ],
    defaults: () => ({ method: "GET", url: "", headerName: "", headerValue: "", body: "" }),
    each(item, ctx) {
      const url = evaluateText(ctx.node.params.url, ctx.scope(item));
      if (!/^https?:\/\//.test(url)) throw new NodeError("URL must start with http:// or https://");
      ctx.world.http.push({ method: str(ctx.node.params.method), url, run: ctx.run });
      return { statusCode: 200, body: {} };
    },
  },
  wait: {
    type: "wait",
    label: "Wait",
    description: "Wait before continuing with execution",
    group: "flow",
    icon: "wait",
    defaultName: "Wait",
    fields: [
      { key: "amount", label: "Wait Amount", kind: "number", min: 0 },
      { key: "unit", label: "Wait Unit", kind: "select", options: ["seconds", "minutes", "hours"].map((u) => ({ value: u, label: u[0]!.toUpperCase() + u.slice(1) })) },
    ],
    defaults: () => ({ amount: 5, unit: "seconds" }),
    batch: (items) => items,
  },
  noop: {
    type: "noop",
    label: "No Operation, do nothing",
    description: "Pass items through unchanged",
    group: "core",
    icon: "noop",
    defaultName: "No Operation, do nothing",
    fields: [],
    defaults: () => ({}),
    batch: (items) => items,
  },
};

export const PALETTE_GROUPS: { group: NodeDef["group"]; types: NodeType[] }[] = [
  { group: "trigger", types: ["sheetsTrigger", "scheduleTrigger", "webhook"] },
  { group: "data", types: ["set"] },
  { group: "flow", types: ["filter", "if", "removeDuplicates", "wait"] },
  { group: "app", types: ["hubspot", "slack", "sheetsAppend"] },
  { group: "core", types: ["http", "noop"] },
];

/** A node's outputs: its own, plus "error" when On Error routes to an error output. */
export function outputsOf(node: SNode): Handle[] {
  const def = NODES[node.type];
  if (def.trigger) return ["main"];
  const own = def.outputs?.(node.params) ?? ["main"];
  return node.settings.onError === "errorOutput" ? [...own, "error"] : own;
}

/** n8n names a second "Filter" "Filter1", and so on. */
export function uniqueName(base: string, taken: string[]) {
  if (!taken.includes(base)) return base;
  let i = 1;
  while (taken.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function createNode(type: NodeType, position: { x: number; y: number }, taken: string[]): SNode {
  const def = NODES[type];
  return { id: newId("n"), type, name: uniqueName(def.defaultName, taken), position, params: def.defaults(), settings: { ...DEFAULT_SETTINGS } };
}
