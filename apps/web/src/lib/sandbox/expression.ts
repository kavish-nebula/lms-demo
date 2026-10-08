import { DateTime } from "./datetime";
import type { Item, Json } from "./types";

/**
 * n8n expressions: JavaScript between {{ }} with $json, $input, $('Node'),
 * $now, $today and DateTime in scope. A value that is exactly one {{ }} keeps
 * its type; anything else is a string with the results spliced in. The
 * learner's own expressions run in their own browser, as in any playground.
 */

export class ExpressionError extends Error {}

export type Scope = {
  item: Item;
  items: Item[];
  workflowName: string;
  execution: number;
};

const SEGMENT = /\{\{([\s\S]*?)\}\}/g;

export const isExpression = (v: unknown): v is string => typeof v === "string" && v.includes("{{");

const cache = new Map<string, (...args: unknown[]) => unknown>();

function compile(code: string) {
  let fn = cache.get(code);
  if (!fn) {
    try {
      fn = new Function("$json", "$input", "$", "$now", "$today", "DateTime", "$workflow", "$execution", `"use strict";\nreturn (${code}\n);`) as (
        ...args: unknown[]
      ) => unknown;
    } catch {
      throw new ExpressionError(`Invalid syntax in {{${code}}}`);
    }
    cache.set(code, fn);
  }
  return fn;
}

/** n8n's string helpers that learners reach for most, available inside expressions only. */
const STRING_HELPERS: Record<string, (this: string, ...a: unknown[]) => unknown> = {
  isEmpty() {
    return this.length === 0;
  },
  isNotEmpty() {
    return this.length > 0;
  },
  isEmail() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this);
  },
  toTitleCase() {
    return this.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  },
  extractEmail() {
    return /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/.exec(this)?.[0];
  },
  toDateTime(format?: unknown) {
    if (typeof format === "string") return DateTime.fromFormat(this, format);
    const iso = DateTime.fromISO(this);
    return iso.isValid ? iso : DateTime.fromJSDate(new Date(this));
  },
};

function withStringHelpers<T>(run: () => T): T {
  const added: string[] = [];
  for (const [name, fn] of Object.entries(STRING_HELPERS)) {
    if (name in String.prototype) continue;
    Object.defineProperty(String.prototype, name, { value: fn, configurable: true, writable: true });
    added.push(name);
  }
  try {
    return run();
  } finally {
    for (const name of added) delete (String.prototype as unknown as Record<string, unknown>)[name];
  }
}

function nodeAccessor(scope: Scope) {
  return (name: string) => {
    const json = scope.item.paired[name];
    const all = () => scope.items.map((i) => ({ json: i.paired[name] ?? {} }));
    return {
      get item() {
        if (!json) throw new ExpressionError(`Referenced node "${name}" hasn't run for this item, or there is no node with that name`);
        return { json };
      },
      first: () => all()[0],
      last: () => all()[all().length - 1],
      all,
    };
  };
}

function runCode(code: string, scope: Scope): unknown {
  const fn = compile(code);
  const input = {
    item: { json: scope.item.json },
    all: () => scope.items.map((i) => ({ json: i.json })),
    first: () => ({ json: scope.items[0]?.json ?? {} }),
    last: () => ({ json: scope.items[scope.items.length - 1]?.json ?? {} }),
  };
  const now = DateTime.now();
  try {
    return withStringHelpers(() =>
      fn(scope.item.json, input, nodeAccessor(scope), now, DateTime.fromObject({ year: now.year, month: now.month, day: now.day }), DateTime, { name: scope.workflowName }, {
        id: String(scope.execution),
      }),
    );
  } catch (e) {
    if (e instanceof ExpressionError) throw e;
    throw new ExpressionError(e instanceof Error ? e.message : String(e));
  }
}

const toText = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof DateTime) return v.toString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Resolve one parameter value for one item. Plain text is returned as it is. */
export function evaluate(value: unknown, scope: Scope): unknown {
  if (!isExpression(value)) return value;
  const whole = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(value);
  if (whole && !whole[1]!.includes("{{") && !whole[1]!.includes("}}")) {
    const v = runCode(whole[1]!, scope);
    return v instanceof DateTime ? v.toString() : v;
  }
  return value.replace(SEGMENT, (_, code: string) => toText(runCode(code, scope)));
}

/** Same as evaluate, as text (what a text field receives). */
export const evaluateText = (value: unknown, scope: Scope) => toText(evaluate(value, scope));

/** For previews: the result, or the error message, never a throw. */
export function preview(value: unknown, scope: Scope | null): { ok: boolean; text: string } {
  if (!scope) return { ok: true, text: "" };
  try {
    const v = evaluate(value, scope);
    return { ok: true, text: typeof v === "string" ? v : JSON.stringify(v) ?? String(v) };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

export const itemOf = (json: Json, paired: Record<string, Json> = {}): Item => ({ json, paired });
