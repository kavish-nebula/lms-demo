/**
 * The capstone sandbox: an n8n-style workflow the learner builds and runs in
 * the browser. Shapes follow n8n closely (nodes, parameters, node settings,
 * connections by output) so what is learned here transfers to real n8n.
 */

export type NodeType =
  | "sheetsTrigger"
  | "scheduleTrigger"
  | "webhook"
  | "set"
  | "filter"
  | "if"
  | "removeDuplicates"
  | "hubspot"
  | "slack"
  | "sheetsAppend"
  | "http"
  | "wait"
  | "noop";

/** A node's outputs: most have one; IF has true/false; any node can add an error output. */
export type Handle = "main" | "true" | "false" | "error";

export type Assignment = { id: string; name: string; type: "string" | "number" | "boolean"; value: string };

export type OperatorId =
  | "s.exists"
  | "s.notExists"
  | "s.empty"
  | "s.notEmpty"
  | "s.eq"
  | "s.neq"
  | "s.contains"
  | "s.notContains"
  | "s.startsWith"
  | "s.endsWith"
  | "s.regex"
  | "n.eq"
  | "n.gt"
  | "n.lt"
  | "b.true"
  | "b.false";

export type Condition = { id: string; left: string; op: OperatorId; right: string };

export type ColumnValue = { column: string; value: string };

export type ParamValue = string | number | boolean | Assignment[] | Condition[] | ColumnValue[];
export type Params = Record<string, ParamValue>;

export type OnError = "stop" | "continue" | "errorOutput";

/** The node "Settings" tab in n8n. */
export type NodeSettings = {
  alwaysOutput: boolean;
  retryOnFail: boolean;
  maxTries: number;
  waitMs: number;
  onError: OnError;
  notes: string;
};

export type SNode = {
  id: string;
  type: NodeType;
  name: string;
  position: { x: number; y: number };
  params: Params;
  settings: NodeSettings;
};

export type SEdge = { id: string; source: string; sourceHandle: Handle; target: string };

export type Workflow = { name: string; nodes: SNode[]; edges: SEdge[] };

/* ---------------------------------------------------------------- running */

export type Json = Record<string, unknown>;

/** One item on the wire, with the json each earlier node produced for it ($('Node').item). */
export type Item = { json: Json; paired: Record<string, Json> };

/** What the outside world does on one run: the CRM can rate-limit once or be down. */
export type Fault = { crm?: "rateLimitOnce" | "down" };

/** A new row in the sign-up sheet: one execution. */
export type TriggerEvent = { row: Json; fault?: Fault };

export type CrmContact = { id: string; email: string; fullName: string; plan: string; signupDate: string; writes: number };

/** The systems the workflow talks to, shared by every run of one session or test. */
export type World = {
  seq: number;
  crm: { contacts: CrmContact[]; calls: { email: string; ok: boolean; status: number; seq: number; run: number }[] };
  slack: { channel: string; text: string; seq: number; run: number }[];
  sheets: Record<string, (Json & { _run: number })[]>;
  dedupe: Record<string, string[]>;
  http: { method: string; url: string; run: number }[];
};

export type NodeRun = {
  status: "success" | "error";
  input: Item[];
  output: Partial<Record<Handle, Item[]>>;
  error?: string;
  /** tries used by the item that needed the most (retry on fail) */
  tries: number;
};

export type Execution = {
  n: number;
  event: TriggerEvent;
  /** skipped: no trigger reacted to the new row */
  status: "success" | "error" | "skipped";
  error?: { nodeId: string; message: string };
  runs: Record<string, NodeRun>;
};
