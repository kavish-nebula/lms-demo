import { ExpressionError, itemOf } from "./expression";
import { DOCUMENT, NODES, NodeError, SIGNUP_SHEET, type NodeCtx } from "./nodes";
import type { Execution, Handle, Item, Json, NodeRun, SNode, TriggerEvent, Workflow, World } from "./types";

/**
 * Runs a sandbox workflow the way n8n runs a published one: each new row in
 * the sign-up sheet starts one execution; items flow along connections; a
 * node runs once per batch it receives. Node settings apply: Retry On Fail,
 * On Error (stop, continue, or the error output) and Always Output Data.
 */

export const emptyWorld = (): World => ({ seq: 0, crm: { contacts: [], calls: [] }, slack: [], sheets: {}, dedupe: {}, http: [] });

/** A Google Sheets Trigger watching the sign-up sheet for new rows. */
export function firesOnNewRow(node: SNode) {
  const p = node.params;
  return node.type === "sheetsTrigger" && p.document === DOCUMENT && p.sheet === SIGNUP_SHEET && (p.event === "rowAdded" || p.event === "rowAddedOrUpdated");
}

class StopError extends Error {
  nodeId: string;
  constructor(nodeId: string, message: string) {
    super(message);
    this.nodeId = nodeId;
  }
}

const MAX_STEPS = 400;

export function execute(wf: Workflow, event: TriggerEvent, world: World, n: number): Execution {
  const exec: Execution = { n, event, status: "success", runs: {} };
  const starts = wf.nodes.filter(firesOnNewRow);
  if (!starts.length) return { ...exec, status: "skipped" };

  const record = (node: SNode, input: Item[], output: Partial<Record<Handle, Item[]>>, failed: boolean, error: string | undefined, tries: number) => {
    const prev = exec.runs[node.id];
    const merged: NodeRun = prev
      ? {
          status: prev.status === "error" || failed ? "error" : "success",
          input: [...prev.input, ...input],
          output: { ...prev.output },
          error: error ?? prev.error,
          tries: Math.max(prev.tries, tries),
        }
      : { status: failed ? "error" : "success", input, output: {}, error, tries };
    for (const [h, list] of Object.entries(output) as [Handle, Item[]][]) merged.output[h] = [...(merged.output[h] ?? []), ...list];
    exec.runs[node.id] = merged;
  };

  const queue: { node: SNode; items: Item[] }[] = [];
  const enqueue = (from: SNode, handle: Handle, items: Item[]) => {
    for (const e of wf.edges) {
      if (e.source !== from.id || e.sourceHandle !== handle) continue;
      const target = wf.nodes.find((x) => x.id === e.target);
      if (target && !NODES[target.type].trigger) queue.push({ node: target, items });
    }
  };

  for (const t of starts) {
    const json: Json = { ...event.row };
    const item = itemOf(json, { [t.name]: json });
    record(t, [], { main: [item] }, false, undefined, 1);
    enqueue(t, "main", [item]);
  }

  let steps = 0;
  try {
    while (queue.length) {
      const next = queue.shift()!;
      if (++steps > MAX_STEPS) throw new StopError(next.node.id, "The workflow ran too many steps. Is there a loop in the connections?");
      const out = runNode(wf, next.node, next.items, world, n, event, record);
      for (const [h, list] of Object.entries(out) as [Handle, Item[]][]) if (list.length) enqueue(next.node, h, list);
    }
  } catch (e) {
    if (!(e instanceof StopError)) throw e;
    exec.status = "error";
    exec.error = { nodeId: e.nodeId, message: e.message };
  }
  return exec;
}

function runNode(
  wf: Workflow,
  node: SNode,
  items: Item[],
  world: World,
  run: number,
  event: TriggerEvent,
  record: (node: SNode, input: Item[], output: Partial<Record<Handle, Item[]>>, failed: boolean, error: string | undefined, tries: number) => void,
): Partial<Record<Handle, Item[]>> {
  const def = NODES[node.type];
  const s = node.settings;
  const out: Partial<Record<Handle, Item[]>> = {};
  const push = (h: Handle, it: Item) => (out[h] ??= []).push(it);
  const derive = (from: Item, json: Json): Item => ({ json, paired: { ...from.paired, [node.name]: json } });
  const ctx: NodeCtx = {
    node,
    world,
    run,
    fault: event.fault ?? {},
    scope: (item) => ({ item, items, workflowName: wf.name, execution: run }),
  };
  let lastError: string | undefined;
  let mostTries = 1;

  const fail = (item: Item | null, message: string) => {
    lastError = message;
    if (s.onError === "stop") {
      record(node, items, out, true, message, mostTries);
      throw new StopError(node.id, message);
    }
    const base = item ?? items[0] ?? itemOf({});
    if (s.onError === "continue") push("main", derive(base, { error: message }));
    else push("error", derive(base, { ...base.json, error: message }));
  };

  if (def.batch) {
    try {
      for (const it of def.batch(items, ctx)) push("main", derive(it, it.json));
    } catch (e) {
      if (!(e instanceof NodeError || e instanceof ExpressionError)) throw e;
      if (s.onError === "stop") fail(null, e.message);
      else for (const it of items) fail(it, e.message);
    }
  } else {
    const tries = s.retryOnFail ? Math.min(5, Math.max(1, Math.floor(s.maxTries) || 1)) : 1;
    for (const item of items) {
      for (let attempt = 1; ; attempt++) {
        mostTries = Math.max(mostTries, attempt);
        try {
          if (def.route) {
            const h = def.route(item, ctx);
            if (h) push(h, derive(item, item.json));
          } else if (def.each) push("main", derive(item, def.each(item, ctx, attempt)));
          else push("main", derive(item, item.json));
          break;
        } catch (e) {
          if (!(e instanceof NodeError || e instanceof ExpressionError)) throw e;
          if (attempt < tries) continue;
          fail(item, e.message);
          break;
        }
      }
    }
  }

  if (s.alwaysOutput && !out.main?.length && !def.outputs) push("main", derive(items[0] ?? itemOf({}), {}));
  record(node, items, out, false, lastError, mostTries);
  return out;
}

/** Several new rows, one execution each, against one shared world. */
export function simulate(wf: Workflow, events: TriggerEvent[], world: World = emptyWorld()) {
  const executions = events.map((ev, i) => execute(wf, ev, world, i + 1));
  return { world, executions };
}

/* ---------------------------------------------------------------- graph helpers */

/** Nodes a trigger can reach, following every output. */
export function reachable(wf: Workflow): Set<string> {
  const seen = new Set<string>();
  const stack = wf.nodes.filter((n) => NODES[n.type].trigger).map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of wf.edges) if (e.source === id) stack.push(e.target);
  }
  return seen;
}

/** Every node upstream of a node. */
export function ancestors(wf: Workflow, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of wf.edges) {
      if (e.target === cur && !seen.has(e.source)) {
        seen.add(e.source);
        stack.push(e.source);
      }
    }
  }
  return seen;
}

/** Items on one connection in an execution (the "3 items" label on a canvas edge). */
export function edgeCount(exec: Execution | null, source: string, handle: Handle): number | null {
  const r = exec?.runs[source];
  if (!r) return null;
  return r.output[handle]?.length ?? 0;
}
